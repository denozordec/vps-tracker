import type { FastifyPluginAsync } from 'fastify'
import { computeDashboardStats } from '../services/dashboard-stats.js'

export const dashboardRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/dashboard/stats', async () => computeDashboardStats())
}
