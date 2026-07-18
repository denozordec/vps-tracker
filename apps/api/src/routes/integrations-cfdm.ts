import type { FastifyPluginAsync } from 'fastify'
import { cfdmSyncBindingsBodySchema } from '@cfdm/shared/contracts/integration-cfdm'
import { settingsRepository } from '@cfdm/db/repositories/settings'
import { vpsDomainsRepository } from '@cfdm/db/repositories/vps-domains'
import {
  requireIntegrationAuth,
  runInIntegrationSpace,
} from '../plugins/integration-auth.js'

export const integrationsCfdmRoutes: FastifyPluginAsync = async (app) => {
  app.post(
    '/api/integrations/cfdm/ping',
    { onRequest: requireIntegrationAuth },
    async (req) =>
      runInIntegrationSpace(req, () => ({ ok: true, service: 'vps-tracker' })),
  )

  app.post(
    '/api/integrations/cfdm/sync-bindings',
    { onRequest: requireIntegrationAuth },
    async (req, reply) => {
      const parsed = cfdmSyncBindingsBodySchema.safeParse(req.body)
      if (!parsed.success) {
        return reply.code(400).send({
          error: { code: 'VALIDATION', message: parsed.error.message },
        })
      }

      return runInIntegrationSpace(req, () => {
        const result = vpsDomainsRepository.syncBindings(parsed.data.bindings)
        settingsRepository.touchIntegrationSync()
        return {
          ok: true,
          ...result,
        }
      })
    },
  )
}
