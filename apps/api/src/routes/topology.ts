import type { FastifyPluginAsync } from 'fastify'
import {
  topologyCreateSchema,
  topologyUpdateSchema,
} from '@cfdm/shared/contracts/topology'
import { topologyRepository } from '@cfdm/db/repositories/topology'
import { canWriteInSpace, requireSpaceRole } from '../plugins/space.js'

export const topologyRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/topology', async () => topologyRepository.list())

  app.get<{ Params: { id: string } }>('/api/topology/:id', async (req, reply) => {
    const diagram = topologyRepository.get(req.params.id)
    if (!diagram) {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Схема не найдена' } })
    }
    return diagram
  })

  app.post('/api/topology', async (req, reply) => {
    if (!requireSpaceRole(req, reply, 'member')) return
    if (!canWriteInSpace(req)) {
      return reply.code(403).send({
        error: { code: 'FORBIDDEN', message: 'Нет прав на запись в пространстве' },
      })
    }
    const parsed = topologyCreateSchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({
        error: {
          code: 'VALIDATION',
          message: parsed.error.issues[0]?.message ?? 'Некорректные данные',
        },
      })
    }
    const created = topologyRepository.create(parsed.data)
    return reply.code(201).send(created)
  })

  app.put<{ Params: { id: string } }>('/api/topology/:id', async (req, reply) => {
    if (!requireSpaceRole(req, reply, 'member')) return
    if (!canWriteInSpace(req)) {
      return reply.code(403).send({
        error: { code: 'FORBIDDEN', message: 'Нет прав на запись в пространстве' },
      })
    }
    const parsed = topologyUpdateSchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({
        error: {
          code: 'VALIDATION',
          message: parsed.error.issues[0]?.message ?? 'Некорректные данные',
        },
      })
    }
    const result = topologyRepository.update(req.params.id, parsed.data)
    if (!result.ok && result.reason === 'not_found') {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Схема не найдена' } })
    }
    if (!result.ok && result.reason === 'stale') {
      return reply.code(409).send({
        error: {
          code: 'CONFLICT',
          message: 'Схема изменена на другом устройстве',
        },
        diagram: result.current,
      })
    }
    if (!result.ok) {
      return reply.code(500).send({ error: { code: 'INTERNAL_ERROR', message: 'Ошибка обновления' } })
    }
    return result.diagram
  })

  app.delete<{ Params: { id: string } }>('/api/topology/:id', async (req, reply) => {
    if (!requireSpaceRole(req, reply, 'member')) return
    if (!canWriteInSpace(req)) {
      return reply.code(403).send({
        error: { code: 'FORBIDDEN', message: 'Нет прав на запись в пространстве' },
      })
    }
    const ok = topologyRepository.delete(req.params.id)
    if (!ok) {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Схема не найдена' } })
    }
    return reply.code(204).send()
  })
}
