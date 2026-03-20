import { Router } from 'express'
import { getDb } from '../db.js'
import { startScheduler } from '../sync-scheduler.js'
import { sendTelegramMessage } from '../telegram.js'

const router = Router()

export function rowToSettings(row) {
  if (!row) return null
  let customFields = []
  if (row.customFields) {
    try {
      customFields = JSON.parse(row.customFields)
    } catch {
      customFields = []
    }
  }
  const { telegramBotToken, ...rest } = row
  return {
    ...rest,
    telegramBotTokenSet: Boolean(telegramBotToken?.trim()),
    autoConvert: Boolean(row.autoConvert),
    syncEnabled: Boolean(row.syncEnabled),
    notifyPaymentExpiryEnabled: Boolean(row.notifyPaymentExpiryEnabled),
    notifyNewTariffsEnabled: Boolean(row.notifyNewTariffsEnabled),
    customFields: Array.isArray(customFields) ? customFields : [],
  }
}

router.post('/telegram/test', async (req, res) => {
  try {
    const db = getDb()
    const row = db.prepare('SELECT telegramBotToken, telegramChatId, telegramMessageThreadId FROM settings WHERE id = ?').get('settings-main')
    if (!row?.telegramBotToken?.trim() || !row?.telegramChatId?.trim()) {
      return res.status(400).json({ ok: false, error: 'Укажите токен бота и Chat ID в настройках' })
    }
    const text = '✅ <b>Тестовое уведомление</b>\n\nVPS Tracker — уведомления настроены корректно.'
    await sendTelegramMessage(row.telegramBotToken, row.telegramChatId, text, row.telegramMessageThreadId || undefined)
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message || 'Ошибка отправки' })
  }
})

router.get('/', (req, res) => {
  try {
    const db = getDb()
    const rows = db.prepare('SELECT * FROM settings ORDER BY id').all()
    res.json(rows.map(rowToSettings))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

function serializeCustomFields(val) {
  if (val == null) return null
  if (Array.isArray(val)) return JSON.stringify(val)
  if (typeof val === 'string') return val || null
  return null
}

router.put('/:id', (req, res) => {
  try {
    const db = getDb()
    const { id } = req.params
    const r = req.body
    const existing = db.prepare('SELECT * FROM settings WHERE id = ?').get(id)
    const syncEnabled = r.syncEnabled !== undefined ? (r.syncEnabled ? 1 : 0) : (existing?.syncEnabled ? 1 : 0)
    const syncIntervalMinutes = r.syncIntervalMinutes !== undefined ? Math.max(15, Number(r.syncIntervalMinutes) || 60) : (existing?.syncIntervalMinutes ?? 60)
    const syncTariffsIntervalMinutes = r.syncTariffsIntervalMinutes !== undefined ? Math.max(60, Number(r.syncTariffsIntervalMinutes) || 1440) : (existing?.syncTariffsIntervalMinutes ?? 1440)
    const notifyPaymentExpiryEnabled = r.notifyPaymentExpiryEnabled !== undefined ? (r.notifyPaymentExpiryEnabled ? 1 : 0) : (existing?.notifyPaymentExpiryEnabled ? 1 : 0)
    const notifyNewTariffsEnabled = r.notifyNewTariffsEnabled !== undefined ? (r.notifyNewTariffsEnabled ? 1 : 0) : (existing?.notifyNewTariffsEnabled ? 1 : 0)
    const telegramBotToken = r.telegramBotToken !== undefined ? (r.telegramBotToken || '') : (existing?.telegramBotToken ?? '')
    const telegramChatId = r.telegramChatId !== undefined ? (r.telegramChatId || '') : (existing?.telegramChatId ?? '')
    const telegramMessageThreadId = r.telegramMessageThreadId !== undefined ? (r.telegramMessageThreadId || '') : (existing?.telegramMessageThreadId ?? '')
    const customFields = serializeCustomFields(r.customFields ?? existing?.customFields)
    if (existing) {
      db.prepare(`
        UPDATE settings SET
          baseCurrency = ?, ratesUrl = ?, autoConvert = ?, ratesUpdatedAt = ?, syncEnabled = ?, syncIntervalMinutes = ?, syncTariffsIntervalMinutes = ?,
          telegramBotToken = ?, telegramChatId = ?, telegramMessageThreadId = ?, notifyPaymentExpiryEnabled = ?, notifyNewTariffsEnabled = ?, customFields = ?
        WHERE id = ?
      `).run(
        r.baseCurrency ?? existing.baseCurrency ?? 'RUB',
        r.ratesUrl ?? existing.ratesUrl ?? '',
        r.autoConvert !== undefined ? (r.autoConvert !== false ? 1 : 0) : (existing.autoConvert ? 1 : 0),
        r.ratesUpdatedAt ?? existing.ratesUpdatedAt ?? '',
        syncEnabled,
        syncIntervalMinutes,
        syncTariffsIntervalMinutes,
        telegramBotToken,
        telegramChatId,
        telegramMessageThreadId,
        notifyPaymentExpiryEnabled,
        notifyNewTariffsEnabled,
        customFields,
        id,
      )
    } else {
      db.prepare(`
        INSERT INTO settings (id, baseCurrency, ratesUrl, autoConvert, ratesUpdatedAt, syncEnabled, syncIntervalMinutes, syncTariffsIntervalMinutes, telegramBotToken, telegramChatId, telegramMessageThreadId, notifyPaymentExpiryEnabled, notifyNewTariffsEnabled, customFields)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        r.baseCurrency ?? 'RUB',
        r.ratesUrl ?? '',
        r.autoConvert !== false ? 1 : 0,
        r.ratesUpdatedAt ?? '',
        syncEnabled,
        syncIntervalMinutes,
        syncTariffsIntervalMinutes,
        telegramBotToken,
        telegramChatId,
        telegramMessageThreadId,
        notifyPaymentExpiryEnabled,
        notifyNewTariffsEnabled,
        customFields,
      )
    }
    startScheduler()
    const row = db.prepare('SELECT * FROM settings WHERE id = ?').get(id)
    res.json(rowToSettings(row))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/', (req, res) => {
  try {
    const db = getDb()
    const r = req.body
    const id = r.id ?? 'settings-main'
    const syncEnabled = r.syncEnabled ? 1 : 0
    const syncIntervalMinutes = Math.max(15, Number(r.syncIntervalMinutes) || 60)
    const syncTariffsIntervalMinutes = Math.max(60, Number(r.syncTariffsIntervalMinutes) || 1440)
    const notifyPaymentExpiryEnabled = r.notifyPaymentExpiryEnabled ? 1 : 0
    const notifyNewTariffsEnabled = r.notifyNewTariffsEnabled ? 1 : 0
    const telegramBotToken = r.telegramBotToken ?? ''
    const telegramChatId = r.telegramChatId ?? ''
    const telegramMessageThreadId = r.telegramMessageThreadId ?? ''
    const customFields = serializeCustomFields(r.customFields)
    db.prepare(`
      INSERT INTO settings (id, baseCurrency, ratesUrl, autoConvert, ratesUpdatedAt, syncEnabled, syncIntervalMinutes, syncTariffsIntervalMinutes, telegramBotToken, telegramChatId, telegramMessageThreadId, notifyPaymentExpiryEnabled, notifyNewTariffsEnabled, customFields)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      r.baseCurrency ?? 'RUB',
      r.ratesUrl ?? 'https://www.cbr-xml-daily.ru/latest.js',
      r.autoConvert !== false ? 1 : 0,
      r.ratesUpdatedAt ?? '',
      syncEnabled,
      syncIntervalMinutes,
      syncTariffsIntervalMinutes,
      telegramBotToken,
      telegramChatId,
      telegramMessageThreadId,
      notifyPaymentExpiryEnabled,
      notifyNewTariffsEnabled,
      customFields,
    )
    startScheduler()
    const row = db.prepare('SELECT * FROM settings WHERE id = ?').get(id)
    res.status(201).json(rowToSettings(row))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
