import Fastify from 'fastify'
import cors from '@fastify/cors'
import sensible from '@fastify/sensible'
import staticPlugin from '@fastify/static'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { getDb } from '@cfdm/db'

import { dataRoutes } from './routes/data.js'
import { vpsRoutes } from './routes/vps.js'
import { providersRoutes } from './routes/providers.js'
import { providerAccountsRoutes } from './routes/provider-accounts.js'
import { paymentsRoutes } from './routes/payments.js'
import { balanceLedgerRoutes } from './routes/balance-ledger.js'
import { settingsRoutes } from './routes/settings.js'
import { syncRoutes } from './routes/sync.js'
import { projectsRoutes } from './routes/projects.js'
import { topologyRoutes } from './routes/topology.js'
import { backupRoutes } from './routes/backup.js'
import { ratesProxyRoutes } from './routes/rates-proxy.js'
import { migrateRoutes } from './routes/migrate.js'
import { dashboardRoutes } from './routes/dashboard.js'
import { auditRoutes } from './routes/audit.js'
import { notificationsRoutes } from './routes/notifications.js'
import { integrationsCfdmRoutes } from './routes/integrations-cfdm.js'
import { appSwitcherRoutes } from './routes/app-switcher.js'
import { startScheduler } from './services/scheduler.js'
import { authPlugin } from './plugins/auth.js'
import { spacePlugin } from './plugins/space.js'
import { spacesRoutes } from './routes/spaces.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

export interface BuildAppOptions {
  dbPath?: string
  staticDir?: string
}

export async function buildApp(opts: BuildAppOptions = {}) {
  if (opts.dbPath) process.env.DB_PATH = opts.dbPath
  getDb()

  const app = Fastify({
    logger: process.env.NODE_ENV !== 'production',
  })

  await app.register(cors, { origin: true })
  await app.register(sensible)
  await app.register(authPlugin)
  await app.register(spacePlugin)

  app.get('/health', async () => ({ ok: true }))

  await app.register(spacesRoutes)
  await app.register(dataRoutes)
  await app.register(vpsRoutes)
  await app.register(providersRoutes)
  await app.register(providerAccountsRoutes)
  await app.register(paymentsRoutes)
  await app.register(balanceLedgerRoutes)
  await app.register(settingsRoutes)
  await app.register(syncRoutes)
  await app.register(projectsRoutes)
  await app.register(topologyRoutes)
  await app.register(backupRoutes)
  await app.register(ratesProxyRoutes)
  await app.register(migrateRoutes)
  await app.register(dashboardRoutes)
  await app.register(auditRoutes)
  await app.register(notificationsRoutes)
  await app.register(integrationsCfdmRoutes)
  await app.register(appSwitcherRoutes)

  const staticDir = opts.staticDir ?? join(__dirname, '..', '..', 'web', 'dist')
  if (existsSync(staticDir)) {
    await app.register(staticPlugin, {
      root: staticDir,
      prefix: '/',
      wildcard: false,
    })
    app.setNotFoundHandler((req, reply) => {
      if (req.url.startsWith('/api')) {
        reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Not found' } })
        return
      }
      reply.sendFile('index.html')
    })
  }

  return app
}

async function start() {
  const port = Number(process.env.PORT ?? 3001)
  const app = await buildApp()
  startScheduler()
  try {
    await app.listen({ port, host: '0.0.0.0' })
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }
}

if (!process.env.VITEST) {
  void start()
}
