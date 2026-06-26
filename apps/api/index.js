import express from 'express'
import cors from 'cors'
import { existsSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { initDb } from './db.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const distPath = join(__dirname, '..', 'dist')
import dataRouter from './routes/data.js'
import migrateRouter from './routes/migrate.js'
import vpsRouter from './routes/vps.js'
import providersRouter from './routes/providers.js'
import providerAccountsRouter from './routes/provider-accounts.js'
import paymentsRouter from './routes/payments.js'
import balanceLedgerRouter from './routes/balance-ledger.js'
import settingsRouter from './routes/settings.js'
import syncRouter from './routes/sync.js'
import projectsRouter from './routes/projects.js'
import backupRouter from './routes/backup.js'
import ratesProxyRouter from './routes/rates-proxy.js'

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors())
app.use(express.json({ limit: '50mb' }))

;(async () => {
  await initDb()

  app.use('/api/data', dataRouter)
  app.use('/api/migrate', migrateRouter)
  app.use('/api/vps', vpsRouter)
  app.use('/api/providers', providersRouter)
  app.use('/api/provider-accounts', providerAccountsRouter)
  app.use('/api/payments', paymentsRouter)
  app.use('/api/balance-ledger', balanceLedgerRouter)
  app.use('/api/settings', settingsRouter)
  app.use('/api/sync', syncRouter)
  app.use('/api/projects', projectsRouter)
  app.use('/api/backup', backupRouter)
  app.use('/api/rates-proxy', ratesProxyRouter)

  if (existsSync(distPath)) {
    app.use(express.static(distPath))
    app.get(/.*/, (req, res, next) => {
      if (req.path.startsWith('/api')) return next()
      res.sendFile(join(distPath, 'index.html'), (err) => (err ? next(err) : undefined))
    })
  }

  const { startScheduler } = await import('./sync-scheduler.js')
  startScheduler()

  app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`)
  })
})()
