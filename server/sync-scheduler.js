import { getDb } from './db.js'
import { runBillmanagerAccountSync } from './sync-account-job.js'
import { sendTelegramMessage } from './telegram.js'

let syncIntervalId = null
let syncTariffsIntervalId = null

const UPCOMING_DAYS = 7

function getAccountBalance(accountId, providerAccounts, balanceLedger) {
  const account = providerAccounts.find((a) => a.id === accountId)
  if (account?.balance_api != null && Number.isFinite(Number(account.balance_api))) {
    return Number(account.balance_api)
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

function getPaidUntilDate(db, vps, providerAccounts, payments, balanceLedger, now) {
  if (vps.status !== 'active') return null
  const account = providerAccounts.find((a) => a.id === vps.providerAccountId)
  const tariffType = vps.tariffType || (Number(vps.dailyRate || 0) > 0 ? 'daily' : 'monthly')
  const isDailyBilling = tariffType === 'daily' || account?.billingMode === 'daily'

  let paidUntilFromApi = null
  if (vps.paidUntil) {
    const d = new Date(vps.paidUntil)
    paidUntilFromApi = Number.isNaN(d.getTime()) ? null : d
  }

  const isPaidUntilNextDay =
    paidUntilFromApi &&
    (() => {
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const diffMs = paidUntilFromApi - today
      const diffDays = Math.round(diffMs / (24 * 60 * 60 * 1000))
      return diffDays >= 0 && diffDays <= 2
    })()

  const shouldCalculateFromBalance = isDailyBilling || isPaidUntilNextDay

  if (!shouldCalculateFromBalance && paidUntilFromApi) return paidUntilFromApi

  const dailyRate = Number(vps.dailyRate || 0)
  const monthlyRate = Number(vps.monthlyRate || 0)
  const burnRate = tariffType === 'daily' ? dailyRate : monthlyRate / 30
  if (!Number.isFinite(burnRate) || burnRate <= 0) return paidUntilFromApi

  const accountBalance = getAccountBalance(vps.providerAccountId, providerAccounts, balanceLedger)
  const activeInAccount = db
    .prepare('SELECT id FROM vps WHERE providerAccountId = ? AND status = ?')
    .all(vps.providerAccountId, 'active').length
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

async function sendPaymentExpiryNotifications(db) {
  const settings = db.prepare('SELECT * FROM settings WHERE id = ?').get('settings-main')
  if (!settings?.notifyPaymentExpiryEnabled || !settings?.telegramBotToken?.trim() || !settings?.telegramChatId?.trim()) {
    return
  }
  const vpsList = db.prepare('SELECT * FROM vps ORDER BY createdAt DESC').all()
  const providerAccounts = db.prepare('SELECT * FROM provider_accounts ORDER BY name').all()
  const payments = db.prepare('SELECT * FROM payments ORDER BY date DESC').all()
  const balanceLedger = db.prepare('SELECT * FROM balance_ledger ORDER BY date DESC').all()
  const providers = db.prepare('SELECT * FROM providers ORDER BY name').all()

  const now = new Date()
  const threshold = new Date(now)
  threshold.setDate(threshold.getDate() + UPCOMING_DAYS)

  const upcoming = []
  for (const vps of vpsList) {
    if (vps.status !== 'active') continue
    const paidUntil = getPaidUntilDate(db, vps, providerAccounts, payments, balanceLedger, now)
    if (!paidUntil || paidUntil > threshold || paidUntil < new Date(now.getFullYear(), now.getMonth(), now.getDate())) continue
    const provider = providers.find((p) => p.id === vps.providerId)
    upcoming.push({ vps, paidUntil, provider: provider?.name || '-' })
  }
  upcoming.sort((a, b) => a.paidUntil - b.paidUntil)

  if (upcoming.length === 0) return

  const lines = upcoming.slice(0, 10).map(({ vps, paidUntil, provider }) => {
    const dateStr = paidUntil.toLocaleDateString('ru-RU')
    return `• ${vps.dns || vps.ip} (${provider}) — до ${dateStr}`
  })
  const text = `⚠️ <b>Истекает оплата</b> (ближайшие ${UPCOMING_DAYS} дней):\n\n${lines.join('\n')}`
  await sendTelegramMessage(settings.telegramBotToken, settings.telegramChatId, text, settings.telegramMessageThreadId)
}

export async function runScheduledSync() {
  try {
    const db = getDb()
    const settings = db.prepare('SELECT * FROM settings WHERE id = ?').get('settings-main')
    if (!settings?.syncEnabled) return
    const accounts = db.prepare(`
      SELECT * FROM provider_accounts
      WHERE apiType = 'billmanager' AND apiBaseUrl IS NOT NULL AND apiBaseUrl != '' AND apiCredentials IS NOT NULL AND apiCredentials != ''
    `).all()

    const digestLines = []
    const lowBalanceLines = []
    const token = settings?.telegramBotToken?.trim()
    const chatId = settings?.telegramChatId?.trim()
    const canTg = Boolean(token && chatId)

    for (const account of accounts) {
      try {
        const result = await runBillmanagerAccountSync(account, { skipTariffs: true })
        const s = result.syncSummary || {}
        const parts = []
        if (s.added?.length) parts.push(`+${s.added.length} VPS`)
        if (s.updated?.length) parts.push(`изм. ${s.updated.length}`)
        if (result.paymentsCount) parts.push(`платежи +${result.paymentsCount}`)
        digestLines.push(`✓ ${account.name}: ${parts.length ? parts.join(', ') : 'без изменений'}`)

        const apiBal = result.balance?.balance
        const threshold = account.balance_alert_below
        if (
          canTg &&
          settings.notifyLowBalanceEnabled &&
          threshold != null &&
          Number.isFinite(Number(threshold)) &&
          apiBal != null &&
          Number.isFinite(Number(apiBal)) &&
          Number(apiBal) < Number(threshold)
        ) {
          const cur = result.balance?.currency || account.balance_currency || account.currency || ''
          lowBalanceLines.push(
            `• ${account.name}: ${apiBal} ${cur} (порог ${threshold})`,
          )
        }
      } catch (err) {
        digestLines.push(`✗ ${account.name}: ${err.message || 'ошибка'}`)
      }
    }

    if (canTg && settings.notifySyncDigestEnabled && digestLines.length > 0) {
      const text = `📋 <b>Синхронизация VPS</b>\n\n${digestLines.join('\n')}`
      await sendTelegramMessage(token, chatId, text, settings.telegramMessageThreadId)
    }
    if (canTg && settings.notifyLowBalanceEnabled && lowBalanceLines.length > 0) {
      const text = `💰 <b>Низкий баланс</b>\n\n${lowBalanceLines.join('\n')}`
      await sendTelegramMessage(token, chatId, text, settings.telegramMessageThreadId)
    }

    if (settings?.notifyPaymentExpiryEnabled) {
      await sendPaymentExpiryNotifications(db)
    }
  } catch (err) {
    console.warn('Scheduled sync error:', err.message)
  }
}

export async function runScheduledSyncTariffs() {
  try {
    const db = getDb()
    const settings = db.prepare('SELECT * FROM settings WHERE id = ?').get('settings-main')
    if (!settings?.syncEnabled) return
    const accounts = db.prepare(`
      SELECT * FROM provider_accounts
      WHERE apiType = 'billmanager' AND apiBaseUrl IS NOT NULL AND apiBaseUrl != '' AND apiCredentials IS NOT NULL AND apiCredentials != ''
    `).all()
    const providers = db.prepare('SELECT * FROM providers ORDER BY name').all()

    for (const account of accounts) {
      try {
        const result = await runBillmanagerAccountSync(account, { skipVpsPayments: true })
        const newTariffs = result?.newTariffs || []
        if (newTariffs.length > 0 && settings?.notifyNewTariffsEnabled && settings?.telegramBotToken?.trim() && settings?.telegramChatId?.trim()) {
          const provider = providers.find((p) => p.id === account.providerId)
          const providerName = provider?.name || account.name || '-'
          const lines = newTariffs.slice(0, 15).map((t) => `• ${t.name || '—'} — ${t.price || '—'}`)
          const text = `🆕 <b>Новые тарифы</b> (${providerName}):\n\n${lines.join('\n')}`
          await sendTelegramMessage(settings.telegramBotToken, settings.telegramChatId, text, settings.telegramMessageThreadId)
        }
      } catch (err) {
        console.warn(`Sync tariffs failed for account ${account.id}:`, err.message)
      }
    }
  } catch (err) {
    console.warn('Scheduled sync tariffs error:', err.message)
  }
}

export function startScheduler() {
  if (syncIntervalId) clearInterval(syncIntervalId)
  syncIntervalId = null
  if (syncTariffsIntervalId) clearInterval(syncTariffsIntervalId)
  syncTariffsIntervalId = null
  try {
    const db = getDb()
    const settings = db.prepare('SELECT * FROM settings WHERE id = ?').get('settings-main')
    if (!settings?.syncEnabled) return
    const interval = Math.max(15, Number(settings.syncIntervalMinutes) || 60)
    const tariffsInterval = Math.max(60, Number(settings.syncTariffsIntervalMinutes) || 1440)
    syncIntervalId = setInterval(runScheduledSync, interval * 60 * 1000)
    syncTariffsIntervalId = setInterval(runScheduledSyncTariffs, tariffsInterval * 60 * 1000)
    console.log(`Scheduled sync enabled: VPS/payments every ${interval} min, tariffs every ${tariffsInterval} min`)
  } catch {
    // ignore
  }
}
