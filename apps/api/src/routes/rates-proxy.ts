import type { FastifyPluginAsync } from 'fastify'

export const ratesProxyRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/rates-proxy', async (req, reply) => {
    const url = (req.query as { url?: string })?.url
    if (!url) {
      return reply.code(400).send({ error: { code: 'VALIDATION', message: 'Missing url parameter' } })
    }
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(10_000) })
      if (!response.ok) {
        return reply.code(502).send({ error: { code: 'UPSTREAM', message: `Upstream returned ${response.status}` } })
      }
      return await response.json()
    } catch (err) {
      return reply.code(502).send({ error: { code: 'UPSTREAM', message: (err as Error).message || 'Failed to fetch rates' } })
    }
  })
}
