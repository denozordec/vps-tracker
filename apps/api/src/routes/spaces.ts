import type { FastifyPluginAsync } from 'fastify'
import { MAIN_SPACE_ID } from '@cfdm/db'
import {
  spacesRepository,
  vpsGrantsRepository,
  type SpaceRole,
  type GrantPermission,
} from '@cfdm/db/repositories/spaces'
import { vpsRepository } from '@cfdm/db/repositories/vps'
import { hasPermission } from '../lib/permissions.js'
import { requireSpaceRole } from '../plugins/space.js'

const ROLES: SpaceRole[] = ['owner', 'admin', 'member', 'viewer']

function isSpacesAdmin(request: { authUser?: { isAdmin?: boolean; permissions: string[] } }) {
  const u = request.authUser
  if (!u) return true
  return Boolean(u.isAdmin) || hasPermission(u.permissions, 'vps:spaces:admin')
}

function canManageDeletedSpace(
  space: { ownerUserId: string | null; id: string },
  userId: string | undefined,
  admin: boolean,
): boolean {
  if (admin) return true
  if (!userId) return true
  if (space.ownerUserId === userId) return true
  const member = spacesRepository.getMember(space.id, userId)
  return member?.role === 'owner'
}

export const spacesRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Querystring: { deleted?: string } }>('/api/spaces', async (req) => {
    const user = req.authUser
    const deletedOnly = req.query.deleted === '1' || req.query.deleted === 'true'
    if (!user) {
      if (deletedOnly) {
        return spacesRepository.listDeleted().map((s) => ({ ...s, role: 'owner' }))
      }
      return spacesRepository.listAll().map((s) => ({ ...s, role: 'owner' }))
    }
    return spacesRepository.listForUser(user.id, isSpacesAdmin(req), { deletedOnly })
  })

  app.post('/api/spaces', async (req, reply) => {
    const user = req.authUser
    if (!user) {
      return reply.code(401).send({
        error: { code: 'UNAUTHORIZED', message: 'Требуется авторизация' },
      })
    }
    const body = req.body as { name?: string; slug?: string }
    const name = String(body.name ?? '').trim() || 'Новое пространство'
    const slug =
      String(body.slug ?? '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, '-') || `space-${Date.now()}`
    const created = spacesRepository.create({
      name,
      slug,
      kind: 'personal',
      ownerUserId: user.id,
    })
    return reply.code(201).send({ ...created, role: 'owner' })
  })

  app.get<{ Params: { id: string } }>('/api/spaces/:id', async (req, reply) => {
    const space = spacesRepository.get(req.params.id)
    if (!space) {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Not found' } })
    }
    const user = req.authUser
    if (user && !spacesRepository.canAccess(space.id, user.id, isSpacesAdmin(req))) {
      return reply.code(403).send({ error: { code: 'FORBIDDEN', message: 'Нет доступа' } })
    }
    const member = user
      ? spacesRepository.getMember(space.id, user.id)
      : { role: 'owner' }
    return { ...space, role: member?.role ?? 'viewer' }
  })

  /** Soft-delete → корзина */
  app.delete<{ Params: { id: string } }>('/api/spaces/:id', async (req, reply) => {
    const space = spacesRepository.getAny(req.params.id)
    if (!space) {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Not found' } })
    }
    if (space.kind === 'main' || space.id === MAIN_SPACE_ID) {
      return reply.code(400).send({
        error: { code: 'VALIDATION', message: 'Нельзя удалить основное пространство' },
      })
    }
    if (!canManageDeletedSpace(space, req.authUser?.id, isSpacesAdmin(req))) {
      return reply.code(403).send({ error: { code: 'FORBIDDEN', message: 'Только владелец' } })
    }
    const updated = spacesRepository.softDelete(req.params.id)
    if (!updated) {
      return reply.code(400).send({
        error: { code: 'VALIDATION', message: 'Не удалось удалить' },
      })
    }
    return updated
  })

  app.post<{ Params: { id: string } }>('/api/spaces/:id/restore', async (req, reply) => {
    const space = spacesRepository.getAny(req.params.id)
    if (!space) {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Not found' } })
    }
    if (!space.deletedAt) {
      return reply.code(400).send({
        error: { code: 'VALIDATION', message: 'Пространство не в корзине' },
      })
    }
    if (!canManageDeletedSpace(space, req.authUser?.id, isSpacesAdmin(req))) {
      return reply.code(403).send({ error: { code: 'FORBIDDEN', message: 'Нет доступа' } })
    }
    return spacesRepository.restore(req.params.id)
  })

  /** Hard purge — only soft-deleted */
  app.delete<{ Params: { id: string } }>('/api/spaces/:id/purge', async (req, reply) => {
    const space = spacesRepository.getAny(req.params.id)
    if (!space) {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Not found' } })
    }
    if (space.kind === 'main' || space.id === MAIN_SPACE_ID) {
      return reply.code(400).send({
        error: { code: 'VALIDATION', message: 'Нельзя удалить основное пространство' },
      })
    }
    if (!space.deletedAt) {
      return reply.code(400).send({
        error: {
          code: 'VALIDATION',
          message: 'Сначала переместите пространство в корзину',
        },
      })
    }
    if (!canManageDeletedSpace(space, req.authUser?.id, isSpacesAdmin(req))) {
      return reply.code(403).send({ error: { code: 'FORBIDDEN', message: 'Нет доступа' } })
    }
    const ok = spacesRepository.purge(req.params.id)
    if (!ok) {
      return reply.code(400).send({
        error: { code: 'VALIDATION', message: 'Не удалось удалить навсегда' },
      })
    }
    return reply.code(204).send()
  })

  app.post<{ Params: { id: string } }>(
    '/api/spaces/:id/transfer-ownership',
    async (req, reply) => {
      const space = spacesRepository.get(req.params.id)
      if (!space) {
        return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Not found' } })
      }
      const user = req.authUser
      const admin = isSpacesAdmin(req)
      if (user) {
        const member = spacesRepository.getMember(space.id, user.id)
        if (!admin && member?.role !== 'owner') {
          return reply.code(403).send({
            error: {
              code: 'FORBIDDEN',
              message: 'Только владелец может передать владение',
            },
          })
        }
      }
      const body = req.body as { newOwnerUserId?: string }
      const newOwnerUserId = String(body.newOwnerUserId ?? '').trim()
      if (!newOwnerUserId) {
        return reply.code(400).send({
          error: { code: 'VALIDATION', message: 'newOwnerUserId обязателен' },
        })
      }
      const updated = spacesRepository.transferOwnership(req.params.id, newOwnerUserId)
      if (!updated) {
        return reply.code(400).send({
          error: { code: 'VALIDATION', message: 'Не удалось передать владение' },
        })
      }
      return updated
    },
  )

  app.patch<{ Params: { id: string } }>('/api/spaces/:id', async (req, reply) => {
    req.spaceId = req.params.id
    if (!requireSpaceRole(req, reply, 'admin')) return
    const body = req.body as { name?: string; slug?: string }
    const updated = spacesRepository.update(req.params.id, {
      ...(body.name !== undefined ? { name: String(body.name).trim() } : {}),
      ...(body.slug !== undefined
        ? { slug: String(body.slug).trim().toLowerCase() }
        : {}),
    })
    if (!updated) {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Not found' } })
    }
    return updated
  })

  app.get<{ Params: { id: string } }>(
    '/api/spaces/:id/members',
    async (req, reply) => {
      req.spaceId = req.params.id
      if (!requireSpaceRole(req, reply, 'viewer')) return
      return spacesRepository.listMembers(req.params.id)
    },
  )

  app.post<{ Params: { id: string } }>(
    '/api/spaces/:id/members',
    async (req, reply) => {
      req.spaceId = req.params.id
      if (!requireSpaceRole(req, reply, 'admin')) return
      const body = req.body as { userId?: string; role?: string }
      const userId = String(body.userId ?? '').trim()
      if (!userId) {
        return reply.code(400).send({
          error: { code: 'VALIDATION', message: 'userId обязателен' },
        })
      }
      const role = (ROLES.includes(body.role as SpaceRole)
        ? body.role
        : 'member') as SpaceRole
      if (role === 'owner') {
        return reply.code(400).send({
          error: { code: 'VALIDATION', message: 'Нельзя назначить owner через invite' },
        })
      }
      const member = spacesRepository.addMember(req.params.id, userId, role)
      return reply.code(201).send(member)
    },
  )

  app.patch<{ Params: { id: string; userId: string } }>(
    '/api/spaces/:id/members/:userId',
    async (req, reply) => {
      req.spaceId = req.params.id
      if (!requireSpaceRole(req, reply, 'admin')) return
      const body = req.body as { role?: string }
      const role = body.role as SpaceRole
      if (!ROLES.includes(role) || role === 'owner') {
        return reply.code(400).send({
          error: { code: 'VALIDATION', message: 'Некорректная роль' },
        })
      }
      const updated = spacesRepository.updateMember(
        req.params.id,
        req.params.userId,
        role,
      )
      if (!updated) {
        return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Not found' } })
      }
      return updated
    },
  )

  app.delete<{ Params: { id: string; userId: string } }>(
    '/api/spaces/:id/members/:userId',
    async (req, reply) => {
      req.spaceId = req.params.id
      if (!requireSpaceRole(req, reply, 'admin')) return
      const member = spacesRepository.getMember(req.params.id, req.params.userId)
      if (member?.role === 'owner') {
        return reply.code(400).send({
          error: { code: 'VALIDATION', message: 'Нельзя удалить владельца' },
        })
      }
      const ok = spacesRepository.removeMember(req.params.id, req.params.userId)
      if (!ok) {
        return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Not found' } })
      }
      return reply.code(204).send()
    },
  )

  app.post<{ Params: { id: string; vpsId: string } }>(
    '/api/spaces/:id/vps/:vpsId/share',
    async (req, reply) => {
      req.spaceId = req.params.id
      if (!requireSpaceRole(req, reply, 'admin')) return
      const body = req.body as { toSpaceId?: string; permission?: string }
      const toSpaceId = String(body.toSpaceId ?? '').trim()
      if (!toSpaceId) {
        return reply.code(400).send({
          error: { code: 'VALIDATION', message: 'toSpaceId обязателен' },
        })
      }
      if (!spacesRepository.get(toSpaceId)) {
        return reply.code(404).send({
          error: { code: 'NOT_FOUND', message: 'Целевое пространство не найдено' },
        })
      }
      const vps = vpsRepository.getAnySpace(req.params.vpsId)
      if (!vps || vps.spaceId !== req.params.id) {
        return reply.code(404).send({
          error: { code: 'NOT_FOUND', message: 'VPS не найден в этом пространстве' },
        })
      }
      const permission: GrantPermission =
        body.permission === 'write' ? 'write' : 'read'
      const grant = vpsGrantsRepository.create({
        vpsId: req.params.vpsId,
        fromSpaceId: req.params.id,
        toSpaceId,
        permission,
        grantedByUserId: req.authUser?.id ?? null,
      })
      return reply.code(201).send(grant)
    },
  )

  app.delete<{ Params: { id: string; grantId: string } }>(
    '/api/spaces/:id/vps-grants/:grantId',
    async (req, reply) => {
      req.spaceId = req.params.id
      if (!requireSpaceRole(req, reply, 'admin')) return
      const grant = vpsGrantsRepository.get(req.params.grantId)
      if (
        !grant ||
        (grant.fromSpaceId !== req.params.id && grant.toSpaceId !== req.params.id)
      ) {
        return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Not found' } })
      }
      vpsGrantsRepository.delete(req.params.grantId)
      return reply.code(204).send()
    },
  )

  app.post<{ Params: { id: string; vpsId: string } }>(
    '/api/spaces/:id/vps/:vpsId/assign',
    async (req, reply) => {
      req.spaceId = req.params.id
      if (!requireSpaceRole(req, reply, 'admin')) return
      const body = req.body as { toSpaceId?: string }
      const toSpaceId = String(body.toSpaceId ?? '').trim()
      if (!toSpaceId) {
        return reply.code(400).send({
          error: { code: 'VALIDATION', message: 'toSpaceId обязателен' },
        })
      }
      if (!spacesRepository.get(toSpaceId)) {
        return reply.code(404).send({
          error: { code: 'NOT_FOUND', message: 'Целевое пространство не найдено' },
        })
      }
      const vps = vpsRepository.getAnySpace(req.params.vpsId)
      if (!vps || vps.spaceId !== req.params.id) {
        return reply.code(404).send({
          error: { code: 'NOT_FOUND', message: 'VPS не найден в этом пространстве' },
        })
      }
      vpsGrantsRepository.deleteByVps(req.params.vpsId)
      return vpsRepository.assignToSpace(req.params.vpsId, toSpaceId)
    },
  )

  app.get<{ Params: { id: string } }>(
    '/api/spaces/:id/vps-grants',
    async (req, reply) => {
      req.spaceId = req.params.id
      if (!requireSpaceRole(req, reply, 'viewer')) return
      return {
        incoming: vpsGrantsRepository.listToSpace(req.params.id),
        outgoing: vpsGrantsRepository.listFromSpace(req.params.id),
      }
    },
  )
}

export { MAIN_SPACE_ID }
