import { desc } from 'drizzle-orm'
import { getDb, schema } from '@cfdm/db'
import { getPaidUntilDate } from '@cfdm/shared/utils/paid-until'
import type { NotificationPayload } from './types.js'

const UPCOMING_DAYS = 7

type VpsRow = typeof schema.vps.$inferSelect

export function buildPaymentExpiryNotification(now = new Date()): NotificationPayload | null {
  const db = getDb()
  const vpsList = db.select().from(schema.vps).orderBy(desc(schema.vps.createdAt)).all()
  const providerAccounts = db.select().from(schema.providerAccounts).all()
  const payments = db.select().from(schema.payments).all()
  const balanceLedger = db.select().from(schema.balanceLedger).all()
  const providers = db.select().from(schema.providers).all()

  const threshold = new Date(now)
  threshold.setDate(threshold.getDate() + UPCOMING_DAYS)
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const ctx = { vps: vpsList, providerAccounts, payments, balanceLedger, now }

  const upcoming: { vps: VpsRow; paidUntil: Date; provider: string }[] = []
  for (const vps of vpsList) {
    if (vps.status !== 'active') continue
    const paidUntil = getPaidUntilDate(vps, ctx)
    if (!paidUntil || paidUntil > threshold || paidUntil < todayStart) continue
    const provider = providers.find((p) => p.id === vps.providerId)
    upcoming.push({ vps, paidUntil, provider: provider?.name || '-' })
  }
  upcoming.sort((a, b) => a.paidUntil.getTime() - b.paidUntil.getTime())
  if (upcoming.length === 0) return null

  const lines = upcoming.slice(0, 10).map(({ vps, paidUntil, provider }) => {
    const dateStr = paidUntil.toLocaleDateString('ru-RU')
    return `• ${vps.dns || vps.ip} (${provider}) — до ${dateStr}`
  })
  const plain = `Истекает оплата (ближайшие ${UPCOMING_DAYS} дней):\n\n${lines.join('\n')}`
  const html = `⚠️ <b>Истекает оплата</b> (ближайшие ${UPCOMING_DAYS} дней):\n\n${lines.join('\n')}`
  const fingerprint = upcoming
    .map(({ vps, paidUntil }) => `${vps.id}:${paidUntil.toISOString().slice(0, 10)}`)
    .sort()
    .join('|')

  return {
    event: 'payment_expiry',
    fingerprint,
    messagePlain: plain,
    messageHtml: html,
    data: { count: upcoming.length, vpsIds: upcoming.map((u) => u.vps.id) },
    dedup: 'daily',
  }
}

export function buildSyncDigestNotification(digestLines: string[]): NotificationPayload | null {
  const changed = digestLines.filter((line) => !line.includes('без изменений'))
  if (changed.length === 0) return null
  const plain = `Синхронизация VPS:\n\n${changed.join('\n')}`
  const html = `📋 <b>Синхронизация VPS</b>\n\n${changed.join('\n')}`
  return {
    event: 'sync_digest',
    fingerprint: changed.sort().join('|'),
    messagePlain: plain,
    messageHtml: html,
    data: { lines: changed },
    dedup: 'fingerprint',
  }
}

export function buildLowBalanceNotification(lines: string[]): NotificationPayload | null {
  if (lines.length === 0) return null
  const plain = `Низкий баланс:\n\n${lines.join('\n')}`
  const html = `💰 <b>Низкий баланс</b>\n\n${lines.join('\n')}`
  return {
    event: 'low_balance',
    fingerprint: lines.sort().join('|'),
    messagePlain: plain,
    messageHtml: html,
    data: { lines },
    dedup: 'daily',
  }
}

export function buildNewTariffsNotification(
  providerName: string,
  tariffs: { name?: string | null; price?: string | null }[],
): NotificationPayload | null {
  if (tariffs.length === 0) return null
  const lines = tariffs.slice(0, 15).map((t) => `• ${t.name || '—'} — ${t.price || '—'}`)
  const plain = `Новые тарифы (${providerName}):\n\n${lines.join('\n')}`
  const html = `🆕 <b>Новые тарифы</b> (${providerName}):\n\n${lines.join('\n')}`
  const fingerprint = tariffs
    .map((t) => `${t.name}:${t.price}`)
    .sort()
    .join('|')
  return {
    event: 'new_tariffs',
    fingerprint: `${providerName}:${fingerprint}`,
    messagePlain: plain,
    messageHtml: html,
    data: { providerName, count: tariffs.length },
    dedup: 'fingerprint',
  }
}

export function buildVpsHealthNotification(
  event: 'vps_down' | 'vps_up',
  hosts: { id: string; label: string }[],
): NotificationPayload | null {
  if (hosts.length === 0) return null
  const lines = hosts.map((h) => `• ${h.label}`)
  const title = event === 'vps_down' ? 'VPS недоступны' : 'VPS восстановлены'
  const icon = event === 'vps_down' ? '🔴' : '🟢'
  const plain = `${title}:\n\n${lines.join('\n')}`
  const html = `${icon} <b>${title}</b>\n\n${lines.join('\n')}`
  const fingerprint = hosts
    .map((h) => h.id)
    .sort()
    .join('|')
  return {
    event,
    fingerprint,
    messagePlain: plain,
    messageHtml: html,
    data: { hosts: hosts.map((h) => h.id) },
    dedup: 'state_transition',
    stateKey: `vps_health:${event}`,
    newStatus: fingerprint,
  }
}
