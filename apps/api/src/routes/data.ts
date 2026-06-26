import type { FastifyPluginAsync } from 'fastify'
import { getSnapshot } from '@cfdm/db/repositories/snapshot'

export const dataRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/data', async () => getSnapshot())
}
