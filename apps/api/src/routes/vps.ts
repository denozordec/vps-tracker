import type { FastifyPluginAsync } from 'fastify'
import { vpsRepository } from '@cfdm/db/repositories/vps'
import { vpsDomainsRepository } from '@cfdm/db/repositories/vps-domains'
import { vpsGrantsRepository } from '@cfdm/db/repositories/spaces'
import { getCurrentSpaceId } from '@cfdm/db'
import { vpsSchema } from '@cfdm/shared/contracts/vps'
import { auditCreate, auditDelete, auditUpdate } from '../services/audit.js'
import { canWriteInSpace, requireSpaceRole } from '../plugins/space.js'

export const vpsRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/vps', async () => {
    const owned = vpsRepository.list()
    const spaceId = getCurrentSpaceId()
    const grants = vpsGrantsRepository.listToSpace(spaceId)
    const ownedIds = new Set(owned.map((v) => v.id))
    const shared = vpsRepository
      .listByIds(grants.map((g) => g.vpsId).filter((id) => !ownedIds.has(id)))
      .map((v) => {
        const g = grants.find((x) => x.vpsId === v.id)
        return {
          ...v,
          access: 'shared' as const,
          grantPermission: (g?.permission === 'write' ? 'write' : 'read') as
            | 'read'
            | 'write',
          providerAccountId: '',
        }
      })
    return [...owned, ...shared]
  })

  app.post('/api/vps', async (req, reply) => {
    if (!requireSpaceRole(req, reply, 'member')) return
    if (!canWriteInSpace(req)) {
      return reply.code(403).send({
        error: { code: 'FORBIDDEN', message: 'Нет прав на запись в пространстве' },
      })
    }
    const parsed = vpsSchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: { code: 'VALIDATION', message: parsed.error.message } })
    }
    const created = vpsRepository.create(parsed.data)
    const list = Array.isArray(created) ? created : [created]
    const last = list[list.length - 1] as { id?: string } | undefined
    if (last?.id) auditCreate('vps', last.id, parsed.data as Record<string, unknown>)
    return reply.code(201).send(created)
  })

  app.put<{ Params: { id: string } }>('/api/vps/:id', async (req, reply) => {
    const parsed = vpsSchema.partial().safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: { code: 'VALIDATION', message: parsed.error.message } })
    }

    const owned = vpsRepository.get(req.params.id)
    if (owned) {
      if (!requireSpaceRole(req, reply, 'member')) return
      const updated = vpsRepository.update(req.params.id, parsed.data)
      if (!updated) {
        return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Not found' } })
      }
      vpsDomainsRepository.rematchAll()
      auditUpdate('vps', req.params.id, parsed.data as Record<string, unknown>)
      return updated
    }

    // Shared write?
    const grant = vpsGrantsRepository.getGrantInCurrentSpace(req.params.id)
    if (grant?.permission === 'write') {
      if (!requireSpaceRole(req, reply, 'member')) return
      const updated = vpsRepository.updateAnySpace(req.params.id, parsed.data)
      if (!updated) {
        return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Not found' } })
      }
      auditUpdate('vps', req.params.id, parsed.data as Record<string, unknown>)
      return { ...updated, access: 'shared', grantPermission: 'write' }
    }

    return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Not found' } })
  })

  app.delete<{ Params: { id: string } }>('/api/vps/:id', async (req, reply) => {
    if (!requireSpaceRole(req, reply, 'member')) return
    const ok = vpsRepository.delete(req.params.id)
    if (!ok) {
      // Shared VPS cannot be deleted from grantee space
      const grant = vpsGrantsRepository.getGrantInCurrentSpace(req.params.id)
      if (grant) {
        return reply.code(403).send({
          error: {
            code: 'FORBIDDEN',
            message: 'Общий VPS можно только отозвать у владельца, не удалить',
          },
        })
      }
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Not found' } })
    }
    auditDelete('vps', req.params.id)
    return reply.code(204).send()
  })

  app.patch('/api/vps/bulk', async (req, reply) => {
    if (!requireSpaceRole(req, reply, 'member')) return
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

  app.get<{ Params: { id: string } }>('/api/vps/:id/domains', async (req) => {
    return vpsDomainsRepository.listByVpsId(req.params.id)
  })
}
