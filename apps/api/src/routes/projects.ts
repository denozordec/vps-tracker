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

  app.put<{ Params: { id: string } }>('/api/projects/:id', async (req, reply) => {
    const body = req.body as { name?: unknown; color?: string | null; notes?: string | null }
    const name = body.name != null ? normalizeProjectNameInput(body.name) : undefined
    if (name === '') {
      return reply.code(400).send({ error: { code: 'VALIDATION', message: 'name cannot be empty' } })
    }
    const updated = projectsRepository.update(req.params.id, {
      ...(name ? { name } : {}),
      color: body.color,
      notes: body.notes,
    })
    if (!updated) {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Not found' } })
    }
    return updated
  })

  app.delete<{ Params: { id: string } }>('/api/projects/:id', async (req, reply) => {
    const ok = projectsRepository.delete(req.params.id)
    if (!ok) {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Not found' } })
    }
    return reply.code(204).send()
  })
}
