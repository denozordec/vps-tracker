import { Router } from 'express'
import { getDb } from '../db.js'

const router = Router()

router.get('/', (req, res) => {
  try {
    const db = getDb()
    const rows = db.prepare('SELECT * FROM providers ORDER BY name').all()
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/', (req, res) => {
  try {
    const db = getDb()
    const r = req.body
    const id = r.id || `provider-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
    db.prepare(`
      INSERT INTO providers (id, name, website, contact, baseCurrency, usdRate, eurRate, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      r.name ?? '',
      r.website ?? '',
      r.contact ?? '',
      r.baseCurrency ?? '',
      r.usdRate ?? '',
      r.eurRate ?? '',
      r.notes ?? '',
    )
    const row = db.prepare('SELECT * FROM providers WHERE id = ?').get(id)
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
      UPDATE providers SET
        name = ?, website = ?, contact = ?, baseCurrency = ?, usdRate = ?, eurRate = ?, notes = ?
      WHERE id = ?
    `).run(
      r.name ?? '',
      r.website ?? '',
      r.contact ?? '',
      r.baseCurrency ?? '',
      r.usdRate ?? '',
      r.eurRate ?? '',
      r.notes ?? '',
      id,
    )
    const row = db.prepare('SELECT * FROM providers WHERE id = ?').get(id)
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
    const result = db.prepare('DELETE FROM providers WHERE id = ?').run(id)
    if (result.changes === 0) return res.status(404).json({ error: 'Not found' })
    res.status(204).send()
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
