import { Router } from 'express'
import { getDb } from '../db.js'
import { rowToVps } from './vps.js'
import { rowToSettings } from './settings.js'
import { sanitizeAccount, rowToActiveTariff, rowToTariffSyncOptions } from '../utils/row-mappers.js'

const router = Router()

router.get('/', (req, res) => {
  try {
    const db = getDb()
    const vps = db.prepare('SELECT * FROM vps ORDER BY createdAt DESC').all()
    const providers = db.prepare('SELECT * FROM providers ORDER BY name').all()
    const providerAccounts = db.prepare('SELECT * FROM provider_accounts ORDER BY name').all()
    const payments = db.prepare('SELECT * FROM payments ORDER BY date DESC').all()
    const balanceLedger = db.prepare('SELECT * FROM balance_ledger ORDER BY date DESC').all()
    const settingsRows = db.prepare('SELECT * FROM settings ORDER BY id').all()
    const activeTariffs = db.prepare('SELECT * FROM active_tariffs ORDER BY name').all()
    const tariffSyncOptions = db.prepare('SELECT * FROM tariff_sync_options').all()

    res.json({
      vps: vps.map(rowToVps),
      providers,
      providerAccounts: providerAccounts.map(sanitizeAccount),
      payments,
      balanceLedger,
      settings: settingsRows.map(rowToSettings),
      activeTariffs: activeTariffs.map(rowToActiveTariff),
      tariffSyncOptions: tariffSyncOptions.map(rowToTariffSyncOptions),
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
