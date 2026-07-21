import type { FastifyRequest } from 'fastify'
import type { AuthUser } from './permissions.js'

export type AuditActorContext = {
  actorUserId: string | null
  actorEmail: string | null
  actorName: string | null
  ip: string | null
}

export function actorFromAuthUser(user?: AuthUser | null): AuditActorContext {
  if (!user) {
    return {
      actorUserId: null,
      actorEmail: null,
      actorName: null,
      ip: null,
    }
  }
  return {
    actorUserId: user.id,
    actorEmail: user.email || null,
    actorName: user.name || null,
    ip: null,
  }
}

export function actorFromRequest(request: FastifyRequest): AuditActorContext {
  const base = actorFromAuthUser(request.authUser)
  const forwarded = request.headers['x-forwarded-for']
  let ip: string | null = request.ip ?? null
  if (typeof forwarded === 'string' && forwarded.trim()) {
    ip = forwarded.split(',')[0]?.trim() ?? ip
  }
  return { ...base, ip }
}
