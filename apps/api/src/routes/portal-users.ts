import type { FastifyPluginAsync } from 'fastify'

/**
 * Proxy portal directory users so the SPA searches by name/email
 * without calling auth-portal CORS from the browser.
 */
export const portalUsersRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Querystring: { q?: string } }>('/api/portal-users', async (req, reply) => {
    const portalUrl = app.authConfig?.portalUrl
    if (!portalUrl) {
      return reply.code(503).send({
        error: { code: 'UNAVAILABLE', message: 'AUTH_PORTAL_URL не настроен' },
      })
    }

    const auth = req.headers.authorization
    if (!auth) {
      return reply.code(401).send({
        error: { code: 'UNAUTHORIZED', message: 'Требуется авторизация' },
      })
    }

    const q = String(req.query.q ?? '').trim()
    const url = new URL('/api/v1/directory/users', portalUrl)
    if (q) url.searchParams.set('q', q)

    try {
      const res = await fetch(url, {
        headers: { Authorization: auth, Accept: 'application/json' },
      })
      if (!res.ok) {
        const text = await res.text()
        return reply.code(res.status).send({
          error: {
            code: 'PORTAL_ERROR',
            message: text || `Portal HTTP ${res.status}`,
          },
        })
      }
      const data = (await res.json()) as { id: string; email: string; name: string }[]
      return Array.isArray(data) ? data : []
    } catch (err) {
      req.log.error(err)
      return reply.code(502).send({
        error: {
          code: 'BAD_GATEWAY',
          message: err instanceof Error ? err.message : 'Ошибка portal',
        },
      })
    }
  })
}
