import type { FastifyPluginAsync } from 'fastify'
import {
  projectsRepository,
  projectSuggestions,
  resolveOrCreateProject,
  normalizeProjectNameInput,
} from '@cfdm/db/repositories/projects'

export const projectsRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/projects', async () => projectsRepository.list())

  app.get('/api/projects/suggest', async (req) => {
    const q = (req.query as { q?: string })?.q ?? ''
    const limit = (req.query as { limit?: string })?.limit
    return projectSuggestions(q, limit ? Number(limit) : 20)
  })

  app.post('/api/projects/resolve-or-create', async (req) => {
    const name = (req.body as { name?: unknown })?.name
    return resolveOrCreateProject(name)
  })

  app.post('/api/projects', async (req, reply) => {
    const name = normalizeProjectNameInput((req.body as { name?: unknown })?.name)
    if (!name) {
      return reply.code(400).send({ error: { code: 'VALIDATION', message: 'name is required' } })
    }
    return reply.code(201).send(resolveOrCreateProject(name))
  })
}
