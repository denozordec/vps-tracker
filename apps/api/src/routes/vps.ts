import type { FastifyPluginAsync } from 'fastify'
import { vpsRepository } from '@cfdm/db/repositories/vps'
import { vpsSchema } from '@cfdm/shared/contracts/vps'

export const vpsRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/vps', async () => vpsRepository.list())

  app.post('/api/vps', async (req, reply) => {
    const parsed = vpsSchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: { code: 'VALIDATION', message: parsed.error.message } })
    }
    return reply.code(201).send(vpsRepository.create(parsed.data))
  })

  app.put<{ Params: { id: string } }>('/api/vps/:id', async (req, reply) => {
    const parsed = vpsSchema.partial().safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: { code: 'VALIDATION', message: parsed.error.message } })
    }
    const updated = vpsRepository.update(req.params.id, parsed.data)
    if (!updated) {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Not found' } })
    }
    return updated
  })

  app.delete<{ Params: { id: string } }>('/api/vps/:id', async (req, reply) => {
    const ok = vpsRepository.delete(req.params.id)
    if (!ok) {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Not found' } })
    }
    return reply.code(204).send()
  })

  app.patch('/api/vps/bulk', async (req, reply) => {
    const body = req.body as { ids?: string[]; action?: string; value?: unknown }
    const ids = Array.isArray(body.ids) ? body.ids : []
    if (ids.length === 0) {
      return reply.code(400).send({ error: { code: 'VALIDATION', message: 'ids must be a non-empty array' } })
    }
    if (body.action === 'status') {
      const validStatus = ['active', 'paused', 'archived']
      const value = String(body.value ?? '')
      if (!validStatus.includes(value)) {
        return reply.code(400).send({ error: { code: 'VALIDATION', message: 'value must be active, paused, or archived' } })
      }
      return { updated: vpsRepository.bulkStatus(ids, value), status: value }
    }
    if (body.action === 'delete') {
      return { deleted: vpsRepository.bulkDelete(ids) }
    }
    if (body.action === 'project') {
      const value = body.value == null ? '' : String(body.value)
      return vpsRepository.bulkProject(ids, value)
    }
    return reply.code(400).send({ error: { code: 'VALIDATION', message: 'action must be status, delete, or project' } })
  })
}
