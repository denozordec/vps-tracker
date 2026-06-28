import type { FastifyPluginAsync } from 'fastify'
import { auditLogRepository } from '@cfdm/db/repositories/audit-log'

export const auditRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/audit', async (req) => {
    const limit = Number((req.query as { limit?: string })?.limit) || 100
    return auditLogRepository.list(limit)
  })

  app.get<{ Params: { entity: string; entityId: string } }>(
    '/api/audit/:entity/:entityId',
    async (req) => auditLogRepository.listForEntity(req.params.entity, req.params.entityId),
  )
}
