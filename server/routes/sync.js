import { Router } from 'express'
import { getDb } from '../db.js'
import { syncFromBillmanager, fetchDashboardInfo, testConnection } from '../adapters/billmanager/index.js'

const router = Router()

router.post('/test-connection', async (req, res) => {
  try {
    const { apiBaseUrl, apiCredentials } = req.body || {}
    if (!apiBaseUrl?.trim() || !apiCredentials?.trim()) {
      return res.status(400).json({ ok: false, error: 'Укажите URL и учётные данные' })
    }
    const result = await testConnection(apiBaseUrl.trim(), apiCredentials.trim())
    res.json(result)
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message || 'Ошибка проверки' })
  }
})

router.get('/status', (req, res) => {
  try {
    const db = getDb()
    const rows = db.prepare(`
      SELECT accountId, startedAt, finishedAt, status, vpsCount, paymentsCount, error
      FROM sync_log ORDER BY startedAt DESC LIMIT 50
    `).all()
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.get('/:accountId/balance', async (req, res) => {
  try {
    const db = getDb()
    const { accountId } = req.params
    const row = db.prepare('SELECT * FROM provider_accounts WHERE id = ?').get(accountId)
    if (!row) {
      return res.status(404).json({ error: 'Account not found' })
    }
    if (row.apiType !== 'billmanager') {
      return res.status(400).json({ error: 'Account is not configured for BILLmanager API' })
    }
    if (!row.apiBaseUrl?.trim() || !row.apiCredentials?.trim()) {
      return res.status(400).json({ error: 'API URL and credentials are required' })
    }
    const info = await fetchDashboardInfo(row.apiBaseUrl, row.apiCredentials.trim(), { fallbackCurrency: row.currency })
    db.run(
      'UPDATE provider_accounts SET balance_api=?, balance_currency=?, balance_updated_at=?, enoughmoneyto=? WHERE id=?',
      info.balance,
      info.currency || 'RUB',
      new Date().toISOString(),
      info.enoughmoneyto || '',
      accountId,
    )
    res.json({ ok: true, balance: info })
  } catch (err) {
    console.error('Balance fetch error:', err)
    res.status(500).json({ ok: false, error: err.message || 'Failed to fetch balance' })
  }
})

router.post('/:accountId', async (req, res) => {
  try {
    const db = getDb()
    const { accountId } = req.params
    const row = db.prepare('SELECT * FROM provider_accounts WHERE id = ?').get(accountId)
    if (!row) {
      return res.status(404).json({ error: 'Account not found' })
    }
    if (row.apiType !== 'billmanager') {
      return res.status(400).json({ error: 'Account is not configured for BILLmanager API' })
    }
    if (!row.apiBaseUrl?.trim() || !row.apiCredentials?.trim()) {
      return res.status(400).json({ error: 'API URL and credentials are required' })
    }

    const logId = `sync-${accountId}-${Date.now()}`
    db.prepare(`
      INSERT INTO sync_log (id, accountId, startedAt, status)
      VALUES (?, ?, ?, ?)
    `).run(logId, accountId, new Date().toISOString(), 'running')

    const result = await syncFromBillmanager(row, db)

    db.prepare(`
      UPDATE sync_log SET finishedAt=?, status=?, vpsCount=?, paymentsCount=?
      WHERE id=?
    `).run(new Date().toISOString(), 'ok', result.vpsCount, result.paymentsCount, logId)

    res.json({
      ok: true,
      synced: {
        vpsCount: result.vpsCount,
        paymentsCount: result.paymentsCount,
        tariffsCount: result.tariffsCount ?? 0,
      },
    })
  } catch (err) {
    console.error('Sync error:', err)
    const { accountId } = req.params
    const db = getDb()
    const logRows = db.prepare('SELECT id FROM sync_log WHERE accountId=? AND status=? ORDER BY startedAt DESC LIMIT 1').all(accountId, 'running')
    if (logRows.length > 0) {
      db.prepare('UPDATE sync_log SET finishedAt=?, status=?, error=? WHERE id=?').run(
        new Date().toISOString(),
        'error',
        err.message || 'Unknown error',
        logRows[0].id,
      )
    }
    res.status(500).json({ ok: false, error: err.message || 'Sync failed' })
  }
})

export default router
