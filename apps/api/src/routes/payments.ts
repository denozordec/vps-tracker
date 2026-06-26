import type { FastifyPluginAsync } from 'fastify'
import { paymentsRepository } from '@cfdm/db/repositories/payments'
import { paymentSchema } from '@cfdm/shared/contracts/payment'

export const paymentsRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/payments', async () => paymentsRepository.list())

  app.post('/api/payments', async (req, reply) => {
    const parsed = paymentSchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: { code: 'VALIDATION', message: parsed.error.message } })
    }
    return reply.code(201).send(paymentsRepository.create(parsed.data))
  })

  app.put<{ Params: { id: string } }>('/api/payments/:id', async (req, reply) => {
    const parsed = paymentSchema.partial().safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: { code: 'VALIDATION', message: parsed.error.message } })
    }
    const updated = paymentsRepository.update(req.params.id, parsed.data)
    if (!updated) {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Not found' } })
    }
    return updated
  })

  app.delete<{ Params: { id: string } }>('/api/payments/:id', async (req, reply) => {
    const ok = paymentsRepository.delete(req.params.id)
    if (!ok) {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Not found' } })
    }
    return reply.code(204).send()
  })
}
