import type { FastifyPluginAsync } from 'fastify'
import { providerAccountsRepository } from '@cfdm/db/repositories/provider-accounts'
import { providerAccountSchema } from '@cfdm/shared/contracts/provider-account'

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
    const ok = providerAccountsRepository.delete(req.params.id)
    if (!ok) {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Not found' } })
    }
    return reply.code(204).send()
  })
}
