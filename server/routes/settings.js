import { Router } from 'express'
import { getDb } from '../db.js'
import { startScheduler } from '../sync-scheduler.js'

const router = Router()

export function rowToSettings(row) {
  if (!row) return null
  return {
    ...row,
    autoConvert: Boolean(row.autoConvert),
    syncEnabled: Boolean(row.syncEnabled),
  }
}

router.get('/', (req, res) => {
  try {
    const db = getDb()
    const rows = db.prepare('SELECT * FROM settings ORDER BY id').all()
    res.json(rows.map(rowToSettings))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.put('/:id', (req, res) => {
  try {
    const db = getDb()
    const { id } = req.params
    const r = req.body
    const existing = db.prepare('SELECT * FROM settings WHERE id = ?').get(id)
    const syncEnabled = r.syncEnabled !== undefined ? (r.syncEnabled ? 1 : 0) : (existing?.syncEnabled ? 1 : 0)
    const syncIntervalMinutes = r.syncIntervalMinutes !== undefined ? Math.max(15, Number(r.syncIntervalMinutes) || 60) : (existing?.syncIntervalMinutes ?? 60)
    if (existing) {
      db.prepare(`
        UPDATE settings SET
          baseCurrency = ?, ratesUrl = ?, autoConvert = ?, ratesUpdatedAt = ?, syncEnabled = ?, syncIntervalMinutes = ?
        WHERE id = ?
      `).run(
        r.baseCurrency ?? existing.baseCurrency ?? 'RUB',
        r.ratesUrl ?? existing.ratesUrl ?? '',
        r.autoConvert !== undefined ? (r.autoConvert !== false ? 1 : 0) : (existing.autoConvert ? 1 : 0),
        r.ratesUpdatedAt ?? existing.ratesUpdatedAt ?? '',
        syncEnabled,
        syncIntervalMinutes,
        id,
      )
    } else {
      db.prepare(`
        INSERT INTO settings (id, baseCurrency, ratesUrl, autoConvert, ratesUpdatedAt, syncEnabled, syncIntervalMinutes)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        r.baseCurrency ?? 'RUB',
        r.ratesUrl ?? '',
        r.autoConvert !== false ? 1 : 0,
        r.ratesUpdatedAt ?? '',
        syncEnabled,
        syncIntervalMinutes,
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
    db.prepare(`
      INSERT INTO settings (id, baseCurrency, ratesUrl, autoConvert, ratesUpdatedAt, syncEnabled, syncIntervalMinutes)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      r.baseCurrency ?? 'RUB',
      r.ratesUrl ?? 'https://www.cbr-xml-daily.ru/latest.js',
      r.autoConvert !== false ? 1 : 0,
      r.ratesUpdatedAt ?? '',
      syncEnabled,
      syncIntervalMinutes,
    )
    startScheduler()
    const row = db.prepare('SELECT * FROM settings WHERE id = ?').get(id)
    res.status(201).json(rowToSettings(row))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
