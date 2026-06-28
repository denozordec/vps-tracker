import type { FastifyPluginAsync } from 'fastify'
import { desc, eq } from 'drizzle-orm'
import { getDb, schema } from '@cfdm/db'
import { providerAccountsRepository } from '@cfdm/db/repositories/provider-accounts'
import { providersRepository } from '@cfdm/db/repositories/providers'

import {
  getProviderAdapter,
  resolveSyncAccount,
  SYNC_SETUP_ERRORS,
} from '../services/providers/index.js'
import { runAccountSync } from '../services/providers/sync-job.js'

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

function setupErrorMessage(apiType: string): string {
  return SYNC_SETUP_ERRORS[apiType] ?? 'Настройте API хостера и учётные данные аккаунта'
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

  app.post<{ Params: { accountId: string }; Body: { onlyTariffs?: boolean } }>(
    '/api/sync/:accountId',
    async (req, reply) => {
      const account = providerAccountsRepository.getWithCredentials(req.params.accountId)
      if (!account) {
        return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Account not found' } })
      }
      const provider = account.providerId ? providersRepository.get(account.providerId) : undefined
      const resolved = resolveSyncAccount(account, provider)
      if (!resolved) {
        const apiType = String(provider?.apiType || 'billmanager').toLowerCase()
        return reply.code(400).send({ error: { code: 'VALIDATION', message: setupErrorMessage(apiType) } })
      }

      const onlyTariffs = Boolean(req.body?.onlyTariffs)
      const opts = onlyTariffs ? { skipVpsPayments: true } : {}
      const adapter = getProviderAdapter(resolved.apiType)

      try {
        const result = await runAccountSync(adapter, resolved.account, opts)
        return {
          ok: true,
          synced: {
            vpsCount: result.vpsCount,
            paymentsCount: result.paymentsCount,
            tariffsCount: result.tariffsCount ?? 0,
          },
        }
      } catch (err) {
        req.log.error(err)
        const message = err instanceof Error ? err.message : 'Sync failed'
        return reply.code(500).send({ ok: false, error: message })
      }
    },
  )

  app.get<{ Params: { accountId: string } }>('/api/sync/:accountId/balance', async (req, reply) => {
    const account = providerAccountsRepository.getWithCredentials(req.params.accountId)
    if (!account) {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Account not found' } })
    }
    const provider = account.providerId ? providersRepository.get(account.providerId) : undefined
    const resolved = resolveSyncAccount(account, provider)
    if (!resolved) {
      const apiType = String(provider?.apiType || 'billmanager').toLowerCase()
      return reply.code(400).send({ error: { code: 'VALIDATION', message: setupErrorMessage(apiType) } })
    }

    const adapter = getProviderAdapter(resolved.apiType)
    if (!adapter.fetchBalance) {
      return reply.code(400).send({ error: { code: 'VALIDATION', message: 'Баланс через API недоступен для этого типа хостера' } })
    }

    try {
      const info = await adapter.fetchBalance(resolved.account)
      getDb()
        .update(schema.providerAccounts)
        .set({
          balanceApi: info.balance,
          balanceCurrency: info.currency || 'RUB',
          balanceUpdatedAt: new Date().toISOString(),
          enoughmoneyto: info.enoughmoneyto || '',
        })
        .where(eq(schema.providerAccounts.id, req.params.accountId))
        .run()
      return { ok: true, balance: info }
    } catch (err) {
      req.log.error(err)
      const message = err instanceof Error ? err.message : 'Failed to fetch balance'
      return reply.code(500).send({ ok: false, error: message })
    }
  })

  app.post('/api/sync/test-connection', async (req, reply) => {
    const { apiBaseUrl, apiCredentials, apiType } = (req.body ?? {}) as {
      apiBaseUrl?: string
      apiCredentials?: string
      apiType?: string
    }
    if (!apiBaseUrl?.trim() || !apiCredentials?.trim()) {
      return reply.code(400).send({ ok: false, error: 'Укажите URL и учётные данные' })
    }
    try {
      const adapter = getProviderAdapter(apiType || 'billmanager')
      const result = await adapter.testConnection(apiBaseUrl.trim(), apiCredentials.trim())
      return result
    } catch (err) {
      req.log.error(err)
      const message = err instanceof Error ? err.message : 'Ошибка проверки'
      return reply.code(500).send({ ok: false, error: message })
    }
  })
}
