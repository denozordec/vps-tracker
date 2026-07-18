import fp from 'fastify-plugin'
import fjwt from '@fastify/jwt'
import type { FastifyReply, FastifyRequest } from 'fastify'
import {
  hasPermission,
  permissionForRequest,
  type AuthUser,
} from '../lib/permissions.js'

export type AuthConfig = {
  required: boolean
  jwtSecret: string
  issuer: string
}

declare module 'fastify' {
  interface FastifyInstance {
    authConfig: AuthConfig
  }
  interface FastifyRequest {
    authUser?: AuthUser
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: {
      sub: string
      email: string
      name: string
      apps?: string[]
      permissions?: string[]
      is_admin?: boolean
      iss?: string
    }
    user: {
      sub: string
      email: string
      name: string
      apps?: string[]
      permissions?: string[]
      is_admin?: boolean
      iss?: string
    }
  }
}

function boolEnv(v: string | undefined, fallback: boolean): boolean {
  if (v === undefined || v === '') return fallback
  return v === '1' || v.toLowerCase() === 'true'
}

export function loadAuthConfig(
  env: NodeJS.ProcessEnv = process.env,
): AuthConfig {
  const isProd = env.NODE_ENV === 'production'
  return {
    required: boolEnv(env.AUTH_REQUIRED, false),
    jwtSecret:
      env.AUTH_JWT_SECRET ??
      env.JWT_SECRET ??
      (isProd ? '' : 'dev-secret-change-me'),
    issuer: env.AUTH_ISSUER ?? env.ISSUER ?? 'https://auth.shnt.top',
  }
}

function isPublicPath(url: string): boolean {
  const path = url.split('?')[0] ?? url
  if (path === '/health' || path === '/ready') return true
  if (path.startsWith('/api/integrations/cfdm')) return true
  return false
}

export const authPlugin = fp(async (app) => {
  const config = loadAuthConfig()
  app.decorate('authConfig', config)

  if (!config.required) {
    app.log.info('AUTH_REQUIRED=false — portal JWT middleware disabled')
    return
  }

  if (!config.jwtSecret || config.jwtSecret.length < 8) {
    throw new Error('AUTH_JWT_SECRET / JWT_SECRET required when AUTH_REQUIRED=true')
  }

  await app.register(fjwt, {
    secret: config.jwtSecret,
    verify: {
      allowedIss: [config.issuer],
    },
  })

  app.addHook('onRequest', async (request, reply) => {
    if (isPublicPath(request.url)) return
    if (!request.url.startsWith('/api/')) return

    try {
      await request.jwtVerify()
    } catch {
      return reply.code(401).send({
        error: { code: 'UNAUTHORIZED', message: 'Требуется авторизация' },
      })
    }

    const payload = request.user
    const apps = Array.isArray(payload.apps) ? payload.apps.map(String) : []
    const permissions = Array.isArray(payload.permissions)
      ? payload.permissions.map(String)
      : []

    if (!apps.includes('vps')) {
      return reply.code(403).send({
        error: {
          code: 'FORBIDDEN',
          message: 'Нет доступа к приложению VPS Tracker',
        },
      })
    }

    request.authUser = {
      id: String(payload.sub),
      email: String(payload.email ?? ''),
      name: String(payload.name ?? ''),
      apps,
      permissions,
      isAdmin: Boolean(payload.is_admin),
    }

    const required = permissionForRequest(request.method, request.url)
    if (required && !hasPermission(permissions, required)) {
      return reply.code(403).send({
        error: {
          code: 'FORBIDDEN',
          message: `Недостаточно прав: ${required}`,
        },
      })
    }
  })
})

export async function requirePermission(
  request: FastifyRequest,
  reply: FastifyReply,
  permission: string,
): Promise<void> {
  const user = request.authUser
  if (!user) {
    return reply.code(401).send({
      error: { code: 'UNAUTHORIZED', message: 'Требуется авторизация' },
    })
  }
  if (!hasPermission(user.permissions, permission)) {
    return reply.code(403).send({
      error: {
        code: 'FORBIDDEN',
        message: `Недостаточно прав: ${permission}`,
      },
    })
  }
}
