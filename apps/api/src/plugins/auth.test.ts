import { describe, expect, it, beforeAll, afterAll } from 'vitest'
import Fastify from 'fastify'
import { authPlugin, loadAuthConfig } from '../plugins/auth.js'

describe('auth plugin (AUTH_REQUIRED)', () => {
  const secret = 'test-secret-at-least-8'
  const issuer = 'https://auth.shnt.top'

  beforeAll(() => {
    process.env.AUTH_REQUIRED = 'true'
    process.env.AUTH_JWT_SECRET = secret
    process.env.AUTH_ISSUER = issuer
  })

  afterAll(() => {
    delete process.env.AUTH_REQUIRED
    delete process.env.AUTH_JWT_SECRET
    delete process.env.AUTH_ISSUER
  })

  it('loadAuthConfig reads env', () => {
    const cfg = loadAuthConfig({
      AUTH_REQUIRED: 'true',
      AUTH_JWT_SECRET: secret,
      AUTH_ISSUER: issuer,
      AUTH_PORTAL_URL: 'http://192.168.100.67:8080',
    })
    expect(cfg.required).toBe(true)
    expect(cfg.jwtSecret).toBe(secret)
    expect(cfg.portalUrl).toBe('http://192.168.100.67:8080')
  })

  it('401 without token; 403 without vps app; 403 without permission; 200 with rights', async () => {
    const app = Fastify()
    await app.register(authPlugin)
    app.get('/api/vps', async () => [{ id: '1' }])
    app.post('/api/vps', async () => ({ ok: true }))
    await app.ready()

    const noAuth = await app.inject({ method: 'GET', url: '/api/vps' })
    expect(noAuth.statusCode).toBe(401)

    const tokenNoApp = app.jwt.sign(
      {
        sub: 'u1',
        email: 'a@b.c',
        name: 'A',
        apps: ['cfdm'],
        permissions: ['vps:vps:read'],
        iss: issuer,
      },
      { expiresIn: '1h' },
    )
    const forbiddenApp = await app.inject({
      method: 'GET',
      url: '/api/vps',
      headers: { authorization: `Bearer ${tokenNoApp}` },
    })
    expect(forbiddenApp.statusCode).toBe(403)

    const readOnly = app.jwt.sign(
      {
        sub: 'u2',
        email: 'r@b.c',
        name: 'R',
        apps: ['vps'],
        permissions: ['vps:vps:read'],
        iss: issuer,
      },
      { expiresIn: '1h' },
    )
    const okRead = await app.inject({
      method: 'GET',
      url: '/api/vps',
      headers: { authorization: `Bearer ${readOnly}` },
    })
    expect(okRead.statusCode).toBe(200)

    const denyWrite = await app.inject({
      method: 'POST',
      url: '/api/vps',
      headers: { authorization: `Bearer ${readOnly}` },
      payload: {},
    })
    expect(denyWrite.statusCode).toBe(403)

    await app.close()
  })
})
