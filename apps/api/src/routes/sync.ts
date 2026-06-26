import type { FastifyPluginAsync } from 'fastify'
import { desc } from 'drizzle-orm'
import { getDb, schema } from '@cfdm/db'
import { providerAccountsRepository } from '@cfdm/db/repositories/provider-accounts'
import { providersRepository } from '@cfdm/db/repositories/providers'

interface SyncLogRow {
  id: string
  accountId: string
  startedAt: string
  finishedAt: string | null
  status: string | null
  vpsCount: number | null
  paymentsCount: number | null
  error: string | null
  summary: unknown
}

function mapSyncLog(row: typeof schema.syncLog.$inferSelect): SyncLogRow {
  let summaryParsed: unknown = null
  if (row.summary) {
    try {
      summaryParsed = JSON.parse(row.summary)
    } catch {
      summaryParsed = null
    }
  }
  return {
    id: row.id,
    accountId: row.accountId,
    startedAt: row.startedAt,
    finishedAt: row.finishedAt,
    status: row.status,
    vpsCount: row.vpsCount,
    paymentsCount: row.paymentsCount,
    error: row.error,
    summary: summaryParsed,
  }
}

export const syncRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/sync/status', async () => {
    const rows = getDb()
      .select()
      .from(schema.syncLog)
      .orderBy(desc(schema.syncLog.startedAt))
      .limit(50)
      .all()
    return rows.map(mapSyncLog)
  })

  app.post<{ Params: { accountId: string } }>('/api/sync/:accountId', async (req, reply) => {
    const account = providerAccountsRepository.getWithCredentials(req.params.accountId)
    if (!account) {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Account not found' } })
    }
    const provider = account.providerId ? providersRepository.get(account.providerId) : undefined
    // TODO: port billmanager sync job
    return reply.code(501).send({
      accountId: req.params.accountId,
      provider: provider?.name ?? null,
      status: 'pending-migration',
      note: 'Sync job port pending migration from Express adapters',
    })
  })

  app.get<{ Params: { accountId: string } }>('/api/sync/:accountId/balance', async (req, reply) => {
    const account = providerAccountsRepository.getWithCredentials(req.params.accountId)
    if (!account) {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Account not found' } })
    }
    // TODO: port fetchDashboardInfo
    return reply.code(501).send({
      accountId: req.params.accountId,
      status: 'pending-migration',
      note: 'Balance fetch pending migration from Express adapters',
    })
  })

  app.post('/api/sync/test-connection', async (req, reply) => {
    const { apiBaseUrl, apiCredentials } = (req.body ?? {}) as {
      apiBaseUrl?: string
      apiCredentials?: string
    }
    if (!apiBaseUrl?.trim() || !apiCredentials?.trim()) {
      return reply.code(400).send({ error: { code: 'VALIDATION', message: 'Укажите URL и учётные данные' } })
    }
    // TODO: port testConnection
    return reply.code(501).send({
      ok: false,
      status: 'pending-migration',
      note: 'Connection test pending migration from Express adapters',
    })
  })
}
