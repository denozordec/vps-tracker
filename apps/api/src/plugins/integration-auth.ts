import { timingSafeEqual } from 'node:crypto'
import type { FastifyReply, FastifyRequest } from 'fastify'
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
  const row = settingsRepository.getRow('settings-main')
  if (!row?.integrationEnabled) {
    return reply.code(403).send({
      error: { code: 'INTEGRATION_DISABLED', message: 'Приём интеграции выключен' },
    })
  }

  const expected = settingsRepository.getIntegrationToken()
  if (!expected) {
    return reply.code(503).send({
      error: { code: 'INTEGRATION_NOT_CONFIGURED', message: 'Integration token не настроен' },
    })
  }

  const provided = extractBearer(request)
  if (!safeEqualToken(expected, provided)) {
    return reply.code(401).send({
      error: { code: 'UNAUTHORIZED', message: 'Неверный integration token' },
    })
  }
}
