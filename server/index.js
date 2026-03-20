import express from 'express'
import cors from 'cors'
import { initDb } from './db.js'
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

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors())
app.use(express.json())

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

  const { startScheduler } = await import('./sync-scheduler.js')
  startScheduler()

  app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`)
  })
})()
