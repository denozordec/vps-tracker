import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify'
import { canonicalizeHoster, censorcheckIngestBodySchema } from '@cfdm/shared/contracts/censorcheck'
import { censorcheckRepository } from '@cfdm/db/repositories/censorcheck'
import { actorFromRequest } from '../lib/audit-actor.js'
import {
  bearerToken,
  ingestSecret,
  verifyIngestToken,
} from '../services/censorcheck/ingest-token.js'
import { matchVpsByPublicIp, resolveProbeIp } from '../services/censorcheck/match-ip.js'
import { normalizeIngestResult, summarizeResults } from '../services/censorcheck/normalize.js'

const BODY_LIMIT = 512 * 1024

function sendError(reply: FastifyReply, status: number, code: string, message: string) {
  return reply.code(status).send({ error: { code, message } })
}

function requireIngestToken(request: FastifyRequest, reply: FastifyReply): boolean {
  const secret = ingestSecret()
  if (!secret) {
    void sendError(reply, 503, 'UNAVAILABLE', 'Censorcheck ingest не настроен')
    return false
  }
  const token = bearerToken(request.headers.authorization)
  if (!token || !verifyIngestToken(token, secret)) {
    void sendError(reply, 401, 'UNAUTHORIZED', 'Недействительный ingest-токен')
    return false
  }
  return true
}

export const censorcheckRoutes: FastifyPluginAsync = async (app) => {
  const ingestOpts = {
    bodyLimit: BODY_LIMIT,
    ...(process.env.VITEST || process.env.CENSORCHECK_RATE_LIMIT === '0'
      ? {}
      : { config: { rateLimit: { max: 6, timeWindow: '1 minute' } } }),
  }

  app.post(
    '/api/integrations/censorcheck/runs',
    ingestOpts,
    async (request, reply) => {
      if (!requireIngestToken(request, reply)) return

      const parsed = censorcheckIngestBodySchema.safeParse(request.body)
      if (!parsed.success) {
        return sendError(reply, 400, 'VALIDATION', parsed.error.message)
      }

      const existing = censorcheckRepository.getByClientRunId(parsed.data.runId)
      if (existing) {
        return {
          id: existing.id,
          runId: existing.runId,
          matchedVpsId: existing.matchedVpsId,
          probePublicIp: existing.probePublicIp,
          summary: existing.summary,
          replayed: true,
        }
      }

      const claimed = parsed.data.probe.publicIp
      const observed = actorFromRequest(request).ip ?? request.ip
      const probePublicIp = resolveProbeIp(observed, claimed)
      const claimedPublicIp =
        claimed && claimed !== probePublicIp ? claimed : null
      const match = matchVpsByPublicIp(probePublicIp)
      const results = parsed.data.results.map(normalizeIngestResult)
      const { summary, runStatus } = summarizeResults(results)

      const created = censorcheckRepository.create({
        spaceId: match.spaceId,
        runId: parsed.data.runId,
        probePublicIp,
        claimedPublicIp,
        matchedVpsId: match.vpsId,
        status: runStatus,
        schemaVersion: parsed.data.schemaVersion,
        launcherVersion: parsed.data.launcherVersion ?? null,
        censorcheckVersion: parsed.data.censorcheck?.version ?? null,
        summary,
        observedSourceIp: observed ?? null,
        detectedHoster: canonicalizeHoster(parsed.data.probe.hoster),
        results,
      })

      return {
        id: created.id,
        runId: created.runId,
        matchedVpsId: created.matchedVpsId,
        probePublicIp: created.probePublicIp,
        summary: created.summary,
      }
    },
  )

  app.get('/api/censorcheck/current', async () => ({
    items: censorcheckRepository.listCurrent(),
  }))

  app.get('/api/censorcheck/runs', async (request) => {
    const q = request.query as Record<string, string | undefined>
    const matched =
      q.matched === '1' || q.matched === 'true'
        ? true
        : q.matched === '0' || q.matched === 'false'
          ? false
          : undefined
    return censorcheckRepository.listHistory({
      cursor: q.cursor,
      limit: q.limit ? Number(q.limit) : undefined,
      q: q.q,
      status: q.status,
      matched,
    })
  })

  app.get('/api/censorcheck/runs/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const run = censorcheckRepository.getById(id)
    if (!run) {
      return sendError(reply, 404, 'NOT_FOUND', 'Прогон не найден')
    }
    return run
  })
}
