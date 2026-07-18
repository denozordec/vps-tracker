import { timingSafeEqual } from 'node:crypto'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { runWithSpace } from '@cfdm/db'
import { settingsRepository } from '@cfdm/db/repositories/settings'

function safeEqualToken(expected: string, provided: string): boolean {
  if (!expected || !provided) return false
  const a = Buffer.from(expected)
  const b = Buffer.from(provided)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

function extractBearer(request: FastifyRequest): string {
  const auth = request.headers.authorization ?? ''
  if (auth.startsWith('Bearer ')) return auth.slice(7).trim()
  return ''
}

export async function requireIntegrationAuth(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const provided = extractBearer(request)
  const row = settingsRepository.findByIntegrationToken(provided)

  if (!row) {
    // Distinguish disabled vs bad token: if any space has integration enabled without match → 401
    const anyEnabled = settingsRepository
      .listAllSpaces()
      .some((r) => r.integrationEnabled && r.integrationToken?.trim())
    if (!anyEnabled) {
      return reply.code(403).send({
        error: { code: 'INTEGRATION_DISABLED', message: 'Приём интеграции выключен' },
      })
    }
    if (!provided) {
      return reply.code(503).send({
        error: {
          code: 'INTEGRATION_NOT_CONFIGURED',
          message: 'Integration token не настроен',
        },
      })
    }
    return reply.code(401).send({
      error: { code: 'UNAUTHORIZED', message: 'Неверный integration token' },
    })
  }

  if (!safeEqualToken(row.integrationToken!.trim(), provided)) {
    return reply.code(401).send({
      error: { code: 'UNAUTHORIZED', message: 'Неверный integration token' },
    })
  }

  request.spaceId = row.spaceId
  // Enter space context for subsequent handlers in this request
  // Note: integrations route registers this as onRequest — ALS via runWithSpace won't wrap handler.
  // Set header for space plugin skip path — integrations are public for portal JWT.
  // Store on request; integrations-cfdm should call runWithSpace when touching DB.
  ;(request as FastifyRequest & { integrationSpaceId?: string }).integrationSpaceId =
    row.spaceId
}

export function runInIntegrationSpace<T>(
  request: FastifyRequest,
  fn: () => T,
): T {
  const spaceId =
    (request as FastifyRequest & { integrationSpaceId?: string }).integrationSpaceId ??
    request.spaceId ??
    'space-main'
  return runWithSpace(spaceId, fn)
}
