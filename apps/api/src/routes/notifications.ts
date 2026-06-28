import type { FastifyPluginAsync } from 'fastify'
import { notificationRepository } from '@cfdm/db/repositories/notifications'

export const notificationsRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Querystring: { limit?: string } }>('/api/notifications/log', async (req) => {
    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50))
    return notificationRepository.listRecent(limit)
  })
}
