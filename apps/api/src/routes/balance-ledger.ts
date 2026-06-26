import type { FastifyPluginAsync } from 'fastify'
import { balanceLedgerRepository } from '@cfdm/db/repositories/balance-ledger'
import { balanceLedgerSchema } from '@cfdm/shared/contracts/balance-ledger'

export const balanceLedgerRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/balance-ledger', async () => balanceLedgerRepository.list())

  app.post('/api/balance-ledger', async (req, reply) => {
    const parsed = balanceLedgerSchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: { code: 'VALIDATION', message: parsed.error.message } })
    }
    return reply.code(201).send(balanceLedgerRepository.create(parsed.data))
  })

  app.put<{ Params: { id: string } }>('/api/balance-ledger/:id', async (req, reply) => {
    const parsed = balanceLedgerSchema.partial().safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: { code: 'VALIDATION', message: parsed.error.message } })
    }
    const updated = balanceLedgerRepository.update(req.params.id, parsed.data)
    if (!updated) {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Not found' } })
    }
    return updated
  })

  app.delete<{ Params: { id: string } }>('/api/balance-ledger/:id', async (req, reply) => {
    const ok = balanceLedgerRepository.delete(req.params.id)
    if (!ok) {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Not found' } })
    }
    return reply.code(204).send()
  })
}
