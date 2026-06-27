import { and, desc, eq, sql } from 'drizzle-orm'
import { getDb, schema } from '@cfdm/db'
import { settingsRepository } from '@cfdm/db/repositories/settings'

import { billmanagerAccountRowForSync } from './billmanager/context.js'
import { runBillmanagerAccountSync } from './billmanager/sync-job.js'
import { sendTelegramMessage } from './telegram.js'

let syncIntervalId: ReturnType<typeof setInterval> | null = null
let syncTariffsIntervalId: ReturnType<typeof setInterval> | null = null

const UPCOMING_DAYS = 7
const SETTINGS_ID = 'settings-main'

type AccountRow = typeof schema.providerAccounts.$inferSelect
type VpsRow = typeof schema.vps.$inferSelect
type PaymentRow = typeof schema.payments.$inferSelect
type LedgerRow = typeof schema.balanceLedger.$inferSelect

function getBillmanagerAccounts(): NonNullable<ReturnType<typeof billmanagerAccountRowForSync>>[] {
  const db = getDb()
  const rows = db
    .all<AccountRow>(sql`
      SELECT pa.* FROM provider_accounts pa
      INNER JOIN providers p ON p.id = pa.providerId
      WHERE lower(trim(COALESCE(p.apiType, ''))) = 'billmanager'
        AND length(trim(COALESCE(p.apiBaseUrl, ''))) > 0
        AND pa.apiCredentials IS NOT NULL AND length(trim(pa.apiCredentials)) > 0
    `)
  const providers = db.select().from(schema.providers).all()
  const providerById = new Map(providers.map((p) => [p.id, p]))
  return rows
    .map((a) => billmanagerAccountRowForSync(a, providerById.get(a.providerId)))
    .filter((a): a is NonNullable<typeof a> => a != null)
}

function getAccountBalance(
  accountId: string,
  providerAccounts: AccountRow[],
  balanceLedger: LedgerRow[],
): number {
  const account = providerAccounts.find((a) => a.id === accountId)
  if (account?.balanceApi != null && Number.isFinite(Number(account.balanceApi))) {
    return Number(account.balanceApi)
  }
  const rows = balanceLedger.filter((row) => row.providerAccountId === accountId)
  const credits = rows
    .filter((row) => row.direction === 'credit')
    .reduce((acc, row) => acc + Number(row.amount || 0), 0)
  const debits = rows
    .filter((row) => row.direction === 'debit')
    .reduce((acc, row) => acc + Number(row.amount || 0), 0)
  return credits - debits
}

function getPaidUntilDate(
  vps: VpsRow,
  providerAccounts: AccountRow[],
  payments: PaymentRow[],
  balanceLedger: LedgerRow[],
  now: Date,
): Date | null {
  if (vps.status !== 'active') return null
  const account = providerAccounts.find((a) => a.id === vps.providerAccountId)
  const tariffType = vps.tariffType || (Number(vps.dailyRate || 0) > 0 ? 'daily' : 'monthly')
  const isDailyBilling = tariffType === 'daily' || account?.billingMode === 'daily'

  let paidUntilFromApi: Date | null = null
  if (vps.paidUntil) {
    const d = new Date(vps.paidUntil)
    paidUntilFromApi = Number.isNaN(d.getTime()) ? null : d
  }

  const isPaidUntilNextDay =
    paidUntilFromApi &&
    (() => {
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const diffDays = Math.round((paidUntilFromApi.getTime() - today.getTime()) / (24 * 60 * 60 * 1000))
      return diffDays >= 0 && diffDays <= 2
    })()

  const shouldCalculateFromBalance = isDailyBilling || isPaidUntilNextDay
  if (!shouldCalculateFromBalance && paidUntilFromApi) return paidUntilFromApi

  const dailyRate = Number(vps.dailyRate || 0)
  const monthlyRate = Number(vps.monthlyRate || 0)
  const burnRate = tariffType === 'daily' ? dailyRate : monthlyRate / 30
  if (!Number.isFinite(burnRate) || burnRate <= 0) return paidUntilFromApi

  const accountBalance = getAccountBalance(vps.providerAccountId ?? '', providerAccounts, balanceLedger)
  const activeInAccount = getDb()
    .select({ id: schema.vps.id })
    .from(schema.vps)
    .where(
      and(eq(schema.vps.providerAccountId, vps.providerAccountId ?? ''), eq(schema.vps.status, 'active')),
    )
    .all().length
  const allocatedBalance = activeInAccount > 0 ? Math.max(0, accountBalance) / activeInAccount : 0
  const directPayments = payments
    .filter((p) => p.vpsId === vps.id && p.type === 'direct_vps_payment')
    .reduce((acc, p) => acc + Number(p.amount || 0), 0)
  const funds = directPayments + allocatedBalance
  const coveredDays = Math.floor(funds / burnRate)
  if (!Number.isFinite(coveredDays) || coveredDays <= 0) return paidUntilFromApi

  const paidUntil = new Date(now)
  paidUntil.setDate(paidUntil.getDate() + coveredDays)
  return paidUntil
}

async function sendPaymentExpiryNotifications(): Promise<void> {
  const settings = settingsRepository.getRow(SETTINGS_ID)
  if (
    !settings?.notifyPaymentExpiryEnabled ||
    !settings.telegramBotToken?.trim() ||
    !settings.telegramChatId?.trim()
  ) {
    return
  }

  const db = getDb()
  const vpsList = db.select().from(schema.vps).orderBy(desc(schema.vps.createdAt)).all()
  const providerAccounts = db.select().from(schema.providerAccounts).all()
  const payments = db.select().from(schema.payments).all()
  const balanceLedger = db.select().from(schema.balanceLedger).all()
  const providers = db.select().from(schema.providers).all()

  const now = new Date()
  const threshold = new Date(now)
  threshold.setDate(threshold.getDate() + UPCOMING_DAYS)
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  const upcoming: { vps: VpsRow; paidUntil: Date; provider: string }[] = []
  for (const vps of vpsList) {
    if (vps.status !== 'active') continue
    const paidUntil = getPaidUntilDate(vps, providerAccounts, payments, balanceLedger, now)
    if (!paidUntil || paidUntil > threshold || paidUntil < todayStart) continue
    const provider = providers.find((p) => p.id === vps.providerId)
    upcoming.push({ vps, paidUntil, provider: provider?.name || '-' })
  }
  upcoming.sort((a, b) => a.paidUntil.getTime() - b.paidUntil.getTime())
  if (upcoming.length === 0) return

  const lines = upcoming.slice(0, 10).map(({ vps, paidUntil, provider }) => {
    const dateStr = paidUntil.toLocaleDateString('ru-RU')
    return `• ${vps.dns || vps.ip} (${provider}) — до ${dateStr}`
  })
  const text = `⚠️ <b>Истекает оплата</b> (ближайшие ${UPCOMING_DAYS} дней):\n\n${lines.join('\n')}`
  await sendTelegramMessage(
    settings.telegramBotToken,
    settings.telegramChatId,
    text,
    settings.telegramMessageThreadId,
  )
}

export async function runScheduledSync(): Promise<void> {
  try {
    const settings = settingsRepository.getRow(SETTINGS_ID)
    if (!settings?.syncEnabled) return

    const accounts = getBillmanagerAccounts()
    const digestLines: string[] = []
    const lowBalanceLines: string[] = []
    const token = settings.telegramBotToken?.trim()
    const chatId = settings.telegramChatId?.trim()
    const canTg = Boolean(token && chatId)

    for (const account of accounts) {
      try {
        const result = await runBillmanagerAccountSync(account, { skipTariffs: true })
        const s = result.syncSummary
        const parts: string[] = []
        if (s.added?.length) parts.push(`+${s.added.length} VPS`)
        if (s.updated?.length) parts.push(`изм. ${s.updated.length}`)
        if (result.paymentsCount) parts.push(`платежи +${result.paymentsCount}`)
        digestLines.push(`✓ ${account.name}: ${parts.length ? parts.join(', ') : 'без изменений'}`)

        const apiBal = result.balance?.balance
        const threshold = account.balanceAlertBelow
        if (
          canTg &&
          settings.notifyLowBalanceEnabled &&
          threshold != null &&
          Number.isFinite(Number(threshold)) &&
          apiBal != null &&
          Number.isFinite(Number(apiBal)) &&
          Number(apiBal) < Number(threshold)
        ) {
          const cur = result.balance?.currency || account.balanceCurrency || account.currency || ''
          lowBalanceLines.push(`• ${account.name}: ${apiBal} ${cur} (порог ${threshold})`)
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'ошибка'
        digestLines.push(`✗ ${account.name}: ${message}`)
      }
    }

    if (canTg && settings.notifySyncDigestEnabled && digestLines.length > 0) {
      await sendTelegramMessage(token!, chatId!, `📋 <b>Синхронизация VPS</b>\n\n${digestLines.join('\n')}`, settings.telegramMessageThreadId)
    }
    if (canTg && settings.notifyLowBalanceEnabled && lowBalanceLines.length > 0) {
      await sendTelegramMessage(token!, chatId!, `💰 <b>Низкий баланс</b>\n\n${lowBalanceLines.join('\n')}`, settings.telegramMessageThreadId)
    }

    if (settings.notifyPaymentExpiryEnabled) {
      await sendPaymentExpiryNotifications()
    }
  } catch (err) {
    console.warn('Scheduled sync error:', err instanceof Error ? err.message : err)
  }
}

export async function runScheduledSyncTariffs(): Promise<void> {
  try {
    const settings = settingsRepository.getRow(SETTINGS_ID)
    if (!settings?.syncEnabled) return

    const accounts = getBillmanagerAccounts()
    const providers = getDb().select().from(schema.providers).all()

    for (const account of accounts) {
      try {
        const result = await runBillmanagerAccountSync(account, { skipVpsPayments: true })
        const newTariffs = result.newTariffs || []
        if (
          newTariffs.length > 0 &&
          settings.notifyNewTariffsEnabled &&
          settings.telegramBotToken?.trim() &&
          settings.telegramChatId?.trim()
        ) {
          const provider = providers.find((p) => p.id === account.providerId)
          const providerName = provider?.name || account.name || '-'
          const lines = newTariffs.slice(0, 15).map((t) => `• ${t.name || '—'} — ${t.price || '—'}`)
          await sendTelegramMessage(
            settings.telegramBotToken,
            settings.telegramChatId,
            `🆕 <b>Новые тарифы</b> (${providerName}):\n\n${lines.join('\n')}`,
            settings.telegramMessageThreadId,
          )
        }
      } catch (err) {
        console.warn(`Sync tariffs failed for account ${account.id}:`, err instanceof Error ? err.message : err)
      }
    }
  } catch (err) {
    console.warn('Scheduled sync tariffs error:', err instanceof Error ? err.message : err)
  }
}

export function startScheduler(): void {
  if (syncIntervalId) clearInterval(syncIntervalId)
  syncIntervalId = null
  if (syncTariffsIntervalId) clearInterval(syncTariffsIntervalId)
  syncTariffsIntervalId = null

  try {
    const settings = settingsRepository.getRow(SETTINGS_ID)
    if (!settings?.syncEnabled) return

    const interval = Math.max(15, Number(settings.syncIntervalMinutes) || 60)
    const tariffsInterval = Math.max(60, Number(settings.syncTariffsIntervalMinutes) || 1440)
    syncIntervalId = setInterval(() => void runScheduledSync(), interval * 60 * 1000)
    syncTariffsIntervalId = setInterval(() => void runScheduledSyncTariffs(), tariffsInterval * 60 * 1000)
    console.log(
      `Scheduled sync enabled: VPS/payments every ${interval} min, tariffs every ${tariffsInterval} min`,
    )
  } catch {
    // ignore
  }
}

export function stopScheduler(): void {
  if (syncIntervalId) clearInterval(syncIntervalId)
  syncIntervalId = null
  if (syncTariffsIntervalId) clearInterval(syncTariffsIntervalId)
  syncTariffsIntervalId = null
}

export function restartScheduler(): void {
  stopScheduler()
  startScheduler()
}
