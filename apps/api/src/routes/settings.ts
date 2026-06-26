import type { FastifyPluginAsync } from 'fastify'
import { settingsRepository } from '@cfdm/db/repositories/settings'
import { settingsSchema } from '@cfdm/shared/contracts/settings'

export const settingsRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/settings', async () => settingsRepository.list())

  app.post('/api/settings', async (req, reply) => {
    const parsed = settingsSchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: { code: 'VALIDATION', message: parsed.error.message } })
    }
    const id = (req.body as { id?: string })?.id ?? 'settings-main'
    return reply.code(201).send(settingsRepository.upsert(id, parsed.data))
  })

  app.put<{ Params: { id: string } }>('/api/settings/:id', async (req, reply) => {
    const parsed = settingsSchema.partial().safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: { code: 'VALIDATION', message: parsed.error.message } })
    }
    return settingsRepository.upsert(req.params.id, parsed.data)
  })

  app.post('/api/settings/telegram/test', async () => ({ ok: true }))
}
