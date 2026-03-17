import { Router } from 'express'
import { getDb } from '../db.js'

const router = Router()

function sanitizeAccount(row) {
  if (!row) return row
  const { apiCredentials, ...rest } = row
  return { ...rest, apiCredentialsSet: Boolean(apiCredentials) }
}

router.get('/', (req, res) => {
  try {
    const db = getDb()
    const rows = db.prepare('SELECT * FROM provider_accounts ORDER BY name').all()
    res.json(rows.map(sanitizeAccount))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/', (req, res) => {
  try {
    const db = getDb()
    const r = req.body
    const id = r.id || `account-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
    db.prepare(`
      INSERT INTO provider_accounts (id, providerId, name, panelUrl, currency, billingMode, notes, apiType, apiBaseUrl, apiCredentials)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      r.providerId ?? '',
      r.name ?? '',
      r.panelUrl ?? '',
      r.currency ?? '',
      r.billingMode ?? '',
      r.notes ?? '',
      r.apiType ?? '',
      r.apiBaseUrl ?? '',
      r.apiCredentials ?? '',
    )
    const row = db.prepare('SELECT * FROM provider_accounts WHERE id = ?').get(id)
    res.status(201).json(sanitizeAccount(row))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.put('/:id', (req, res) => {
  try {
    const db = getDb()
    const { id } = req.params
    const r = req.body
    const existing = db.prepare('SELECT * FROM provider_accounts WHERE id = ?').get(id)
    if (!existing) return res.status(404).json({ error: 'Not found' })
    const apiType = r.apiType !== undefined ? String(r.apiType || '') : (existing.apiType || '')
    const apiBaseUrl = r.apiBaseUrl !== undefined ? String(r.apiBaseUrl || '') : (existing.apiBaseUrl || '')
    const apiCredentials = r.apiCredentials !== undefined ? String(r.apiCredentials || '') : (existing.apiCredentials || '')
    db.prepare(`
      UPDATE provider_accounts SET
        providerId = ?, name = ?, panelUrl = ?, currency = ?, billingMode = ?, notes = ?, apiType = ?, apiBaseUrl = ?, apiCredentials = ?
      WHERE id = ?
    `).run(
      r.providerId ?? existing.providerId ?? '',
      r.name ?? existing.name ?? '',
      r.panelUrl ?? existing.panelUrl ?? '',
      r.currency ?? existing.currency ?? '',
      r.billingMode ?? existing.billingMode ?? '',
      r.notes ?? existing.notes ?? '',
      apiType,
      apiBaseUrl,
      apiCredentials,
      id,
    )
    const row = db.prepare('SELECT * FROM provider_accounts WHERE id = ?').get(id)
    res.json(sanitizeAccount(row))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.delete('/:id', (req, res) => {
  try {
    const db = getDb()
    const { id } = req.params
    const result = db.prepare('DELETE FROM provider_accounts WHERE id = ?').run(id)
    if (result.changes === 0) return res.status(404).json({ error: 'Not found' })
    res.status(204).send()
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
