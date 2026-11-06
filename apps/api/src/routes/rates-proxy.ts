import type { FastifyPluginAsync } from 'fastify'
import { settingsRepository } from '@cfdm/db/repositories/settings'

export const ratesProxyRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/rates-proxy', async (req, reply) => {
    const ratesUrl = settingsRepository.getBySpace()?.ratesUrl?.trim()
    if (!ratesUrl) {
      return reply.code(400).send({ error: { code: 'VALIDATION', message: 'ratesUrl не задан в настройках' } })
    }
    // Only the saved ratesUrl is fetched — an arbitrary ?url= would be an open SSRF proxy.
    const url = (req.query as { url?: string })?.url
    if (url && url.trim() !== ratesUrl) {
      return reply.code(400).send({ error: { code: 'VALIDATION', message: 'url должен совпадать с ratesUrl из настроек' } })
    }
    try {
      const response = await fetch(ratesUrl, { signal: AbortSignal.timeout(10_000) })
      if (!response.ok) {
        return reply.code(502).send({ error: { code: 'UPSTREAM', message: `Upstream returned ${response.status}` } })
      }
      return await response.json()
    } catch (err) {
      return reply.code(502).send({ error: { code: 'UPSTREAM', message: (err as Error).message || 'Failed to fetch rates' } })
    }
  })
}
