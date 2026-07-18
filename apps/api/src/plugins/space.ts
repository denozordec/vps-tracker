import { AsyncLocalStorage } from 'node:async_hooks'
import fp from 'fastify-plugin'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { MAIN_SPACE_ID } from '@cfdm/db'
import {
  spacesRepository,
  roleAtLeast,
  type SpaceRole,
} from '@cfdm/db/repositories/spaces'
import { hasPermission } from '../lib/permissions.js'

/** Request-scoped space ALS — entered in onRequest callback form so handlers inherit it. */
const spaceAls = new AsyncLocalStorage<{ spaceId: string }>()

export function getRequestSpaceId(): string {
  return spaceAls.getStore()?.spaceId ?? MAIN_SPACE_ID
}

declare module 'fastify' {
  interface FastifyRequest {
    spaceId?: string
    spaceRole?: string
  }
}

function isSpacePublicPath(url: string): boolean {
  const path = url.split('?')[0] ?? url
  if (path === '/health' || path === '/ready') return true
  if (path === '/api/auth/config') return true
  if (path.startsWith('/api/integrations/cfdm')) return true
  return false
}

function headerSpaceId(request: FastifyRequest): string | undefined {
  const raw = request.headers['x-space-id']
  if (typeof raw === 'string' && raw.trim()) return raw.trim()
  if (Array.isArray(raw) && raw[0]?.trim()) return raw[0].trim()
  return undefined
}

export async function ensureUserSpaces(request: FastifyRequest): Promise<void> {
  const user = request.authUser
  if (!user) return

  spacesRepository.ensurePersonalSpace(user.id, user.name || user.email)

  if (user.isAdmin) {
    spacesRepository.claimMainOwnerIfEmpty(user.id)
  }

  if (hasPermission(user.permissions, 'vps:spaces:admin')) {
    const mainMember = spacesRepository.getMember(MAIN_SPACE_ID, user.id)
    if (!mainMember) {
      spacesRepository.addMember(MAIN_SPACE_ID, user.id, 'admin')
    }
  }
}

/**
 * Bridge request ALS into @cfdm/db space-context by syncing store.
 * Handlers use getCurrentSpaceId from @cfdm/db — we enter BOTH stores.
 */
import { runWithSpace } from '@cfdm/db'

export const spacePlugin = fp(async (app) => {
  app.addHook('onRequest', (request, reply, done) => {
    void (async () => {
      try {
        if (isSpacePublicPath(request.url) || !request.url.startsWith('/api/')) {
          done()
          return
        }

        const authRequired = app.authConfig?.required

        if (authRequired && request.authUser) {
          await ensureUserSpaces(request)
        }

        let spaceId = headerSpaceId(request) ?? MAIN_SPACE_ID

        if (authRequired && request.authUser) {
          const user = request.authUser
          const canSpacesAdmin =
            Boolean(user.isAdmin) ||
            hasPermission(user.permissions, 'vps:spaces:admin')

          if (!spacesRepository.canAccess(spaceId, user.id, canSpacesAdmin)) {
            const personal = spacesRepository.ensurePersonalSpace(
              user.id,
              user.name || user.email,
            )
            spaceId = personal.id
            if (!spacesRepository.canAccess(spaceId, user.id, canSpacesAdmin)) {
              reply.code(403).send({
                error: {
                  code: 'FORBIDDEN',
                  message: 'Нет доступа к пространству',
                },
              })
              return
            }
          }

          const member = spacesRepository.getMember(spaceId, user.id)
          request.spaceRole =
            member?.role ?? (canSpacesAdmin ? 'admin' : 'viewer')
        } else {
          spacesRepository.getMain()
          request.spaceRole = 'owner'
        }

        request.spaceId = spaceId

        // Enter ALS for the rest of the request (callback-style keeps context)
        runWithSpace(spaceId, () => {
          spaceAls.run({ spaceId }, () => {
            done()
          })
        })
      } catch (err) {
        done(err as Error)
      }
    })()
  })
})

export function requireSpaceRole(
  request: FastifyRequest,
  reply: FastifyReply,
  min: SpaceRole,
): boolean {
  const user = request.authUser
  const spaceId = request.spaceId ?? MAIN_SPACE_ID
  if (!user) {
    return true
  }
  const canSpacesAdmin =
    Boolean(user.isAdmin) ||
    hasPermission(user.permissions, 'vps:spaces:admin')
  const member = spacesRepository.requireRole(
    spaceId,
    user.id,
    min,
    canSpacesAdmin,
  )
  if (!member) {
    void reply.code(403).send({
      error: {
        code: 'FORBIDDEN',
        message: `Недостаточно прав в пространстве (нужно: ${min})`,
      },
    })
    return false
  }
  return true
}

export function canWriteInSpace(request: FastifyRequest): boolean {
  const role = request.spaceRole ?? 'viewer'
  return roleAtLeast(role, 'member')
}
