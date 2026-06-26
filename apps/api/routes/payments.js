import { Router } from 'express'
import { getDb } from '../db.js'

const router = Router()

router.get('/', (req, res) => {
  try {
    const db = getDb()
    const rows = db.prepare('SELECT * FROM payments ORDER BY date DESC').all()
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/', (req, res) => {
  try {
    const db = getDb()
    const r = req.body
    const id = r.id || `pay-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
    db.prepare(`
      INSERT INTO payments (id, type, date, amount, currency, providerAccountId, vpsId, note)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      r.type ?? '',
      r.date ?? '',
      Number(r.amount) || 0,
      r.currency ?? '',
      r.providerAccountId ?? '',
      r.vpsId ?? '',
      r.note ?? '',
    )
    const row = db.prepare('SELECT * FROM payments WHERE id = ?').get(id)
    res.status(201).json(row)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.put('/:id', (req, res) => {
  try {
    const db = getDb()
    const { id } = req.params
    const r = req.body
    db.prepare(`
      UPDATE payments SET
        type = ?, date = ?, amount = ?, currency = ?, providerAccountId = ?, vpsId = ?, note = ?
      WHERE id = ?
    `).run(
      r.type ?? '',
      r.date ?? '',
      Number(r.amount) || 0,
      r.currency ?? '',
      r.providerAccountId ?? '',
      r.vpsId ?? '',
      r.note ?? '',
      id,
    )
    const row = db.prepare('SELECT * FROM payments WHERE id = ?').get(id)
    if (!row) return res.status(404).json({ error: 'Not found' })
    res.json(row)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.delete('/:id', (req, res) => {
  try {
    const db = getDb()
    const { id } = req.params
    const result = db.prepare('DELETE FROM payments WHERE id = ?').run(id)
    if (result.changes === 0) return res.status(404).json({ error: 'Not found' })
    res.status(204).send()
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
