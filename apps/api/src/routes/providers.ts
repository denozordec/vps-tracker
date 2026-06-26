import type { FastifyPluginAsync } from 'fastify'
import { providersRepository } from '@cfdm/db/repositories/providers'
import { providerSchema } from '@cfdm/shared/contracts/provider'

export const providersRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/providers', async () => providersRepository.list())

  app.post('/api/providers', async (req, reply) => {
    const parsed = providerSchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: { code: 'VALIDATION', message: parsed.error.message } })
    }
    const created = providersRepository.create(parsed.data)
    return reply.code(201).send(created)
  })

  app.put<{ Params: { id: string } }>('/api/providers/:id', async (req, reply) => {
    const parsed = providerSchema.partial().safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: { code: 'VALIDATION', message: parsed.error.message } })
    }
    const updated = providersRepository.update(req.params.id, parsed.data)
    if (!updated) {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Not found' } })
    }
    return updated
  })

  app.delete<{ Params: { id: string } }>('/api/providers/:id', async (req, reply) => {
    const ok = providersRepository.delete(req.params.id)
    if (!ok) {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Not found' } })
    }
    return reply.code(204).send()
  })
}
