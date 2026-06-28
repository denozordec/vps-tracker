import type { FastifyPluginAsync } from 'fastify'
import { providerAccountsRepository } from '@cfdm/db/repositories/provider-accounts'
import { providerAccountSchema } from '@cfdm/shared/contracts/provider-account'

function formatDependencyMessage(deps: ReturnType<typeof providerAccountsRepository.getDependencyCounts>): string {
  const parts: string[] = []
  if (deps.vps) parts.push(`VPS: ${deps.vps}`)
  if (deps.payments) parts.push(`платежи: ${deps.payments}`)
  if (deps.balanceLedger) parts.push(`журнал баланса: ${deps.balanceLedger}`)
  if (deps.activeTariffs) parts.push(`тарифы: ${deps.activeTariffs}`)
  if (deps.syncLog) parts.push(`записи синка: ${deps.syncLog}`)
  return parts.length ? `Аккаунт используется (${parts.join(', ')})` : 'Аккаунт используется связанными записями'
}

export const providerAccountsRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/provider-accounts', async () => providerAccountsRepository.list())

  app.post('/api/provider-accounts', async (req, reply) => {
    const parsed = providerAccountSchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: { code: 'VALIDATION', message: parsed.error.message } })
    }
    const created = providerAccountsRepository.create(parsed.data)
    return reply.code(201).send(created)
  })

  app.put<{ Params: { id: string } }>('/api/provider-accounts/:id', async (req, reply) => {
    const parsed = providerAccountSchema.partial().safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: { code: 'VALIDATION', message: parsed.error.message } })
    }
    const updated = providerAccountsRepository.update(req.params.id, parsed.data)
    if (!updated) {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Not found' } })
    }
    return updated
  })

  app.delete<{ Params: { id: string } }>('/api/provider-accounts/:id', async (req, reply) => {
    const existing = providerAccountsRepository.get(req.params.id)
    if (!existing) {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Not found' } })
    }
    const dependencies = providerAccountsRepository.getDependencyCounts(req.params.id)
    const total =
      dependencies.vps +
      dependencies.payments +
      dependencies.balanceLedger +
      dependencies.activeTariffs +
      dependencies.syncLog
    if (total > 0) {
      return reply.code(409).send({
        error: {
          code: 'CONFLICT',
          message: formatDependencyMessage(dependencies),
          dependencies,
        },
      })
    }
    providerAccountsRepository.delete(req.params.id)
    return reply.code(204).send()
  })
}
