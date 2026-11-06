import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { closeDb, getSqlite } from '@cfdm/db'
import { resetTestDb, seedTestProvider } from '@cfdm/db/test-setup'
import { settingsRepository } from '@cfdm/db/repositories/settings'
import { spacesRepository } from '@cfdm/db/repositories/spaces'
import { buildApp } from '../index.js'
import { needsMemberRole } from '../plugins/space.js'
import { runAccountSync, SyncInProgressError } from '../services/providers/sync-job.js'
import type { ProviderAdapter } from '../services/providers/types.js'

describe('rates-proxy', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  beforeEach(async () => {
    resetTestDb()
    settingsRepository.upsertForSpace('space-main', { ratesUrl: 'https://rates.test/daily.json' })
    app = await buildApp()
  })
  afterEach(async () => {
    await app.close()
    vi.unstubAllGlobals()
    closeDb()
  })

  it('refuses a url other than the saved ratesUrl', async () => {
    const fetchMock = vi.fn<typeof fetch>()
    vi.stubGlobal('fetch', fetchMock)
    const res = await app.inject({ url: '/api/rates-proxy?url=http://169.254.169.254/latest' })
    expect(res.statusCode).toBe(400)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('fetches the saved ratesUrl', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => Response.json({ USD: 1 }))
    vi.stubGlobal('fetch', fetchMock)
    const res = await app.inject({
      url: `/api/rates-proxy?url=${encodeURIComponent('https://rates.test/daily.json')}`,
    })
    expect(res.statusCode).toBe(200)
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://rates.test/daily.json')
  })
})

describe('GET /api/sync/status', () => {
  beforeEach(() => {
    resetTestDb()
    seedTestProvider()
  })
  afterEach(() => closeDb())

  it('returns only the current space log', async () => {
    const sqlite = getSqlite()
    sqlite.exec(`INSERT INTO spaces (id, name, slug, kind, createdAt) VALUES ('space-x', 'X', 'x', 'personal', '2026-01-01')`)
    sqlite.exec(`INSERT INTO provider_accounts (id, spaceId, providerId, name) VALUES ('acc-x', 'space-x', 'prov-1', 'X')`)
    sqlite.exec(`INSERT INTO sync_log (id, spaceId, accountId, startedAt, status) VALUES ('l-x', 'space-x', 'acc-x', '2026-01-01', 'ok')`)
    const app = await buildApp()
    const main = await app.inject({ url: '/api/sync/status' })
    expect((main.json() as unknown[]).length).toBe(0)
    const x = await app.inject({ url: '/api/sync/status', headers: { 'x-space-id': 'space-x' } })
    expect((x.json() as { id: string }[]).map((r) => r.id)).toEqual(['l-x'])
    await app.close()
  })
})

describe('runAccountSync lock', () => {
  beforeEach(() => {
    resetTestDb()
    seedTestProvider()
  })
  afterEach(() => closeDb())

  it('rejects a second sync of the same account while one is running', async () => {
    getSqlite().exec(`INSERT INTO provider_accounts (id, spaceId, providerId, name) VALUES ('acc-l', 'space-main', 'prov-1', 'L')`)
    let finish!: () => void
    const adapter = {
      syncAccount: () =>
        new Promise((resolve) => {
          finish = () => resolve({ vpsCount: 0, paymentsCount: 0, syncSummary: {} })
        }),
    } as unknown as ProviderAdapter
    const first = runAccountSync(adapter, { id: 'acc-l' })
    await expect(runAccountSync(adapter, { id: 'acc-l' })).rejects.toBeInstanceOf(SyncInProgressError)
    finish()
    await first
    finish = undefined as never
    const again = runAccountSync(adapter, { id: 'acc-l' })
    finish()
    await expect(again).resolves.toMatchObject({ ok: true })
  })
})

describe('space viewer cannot write', () => {
  const secret = 'test-secret-at-least-8'
  beforeEach(() => {
    process.env.AUTH_REQUIRED = 'true'
    process.env.AUTH_JWT_SECRET = secret
    resetTestDb()
  })
  afterEach(() => {
    delete process.env.AUTH_REQUIRED
    delete process.env.AUTH_JWT_SECRET
    closeDb()
  })

  it('needsMemberRole covers money/provider writes and sync', () => {
    expect(needsMemberRole('POST', '/api/payments')).toBe(true)
    expect(needsMemberRole('GET', '/api/payments')).toBe(false)
    expect(needsMemberRole('GET', '/api/sync/acc-1/balance')).toBe(true)
    expect(needsMemberRole('GET', '/api/sync/status')).toBe(false)
    expect(needsMemberRole('DELETE', '/api/provider-accounts/a')).toBe(true)
  })

  it('403 for viewer, 201 for member on POST /api/payments', async () => {
    spacesRepository.create({ id: 'space-team', name: 'Team', slug: 'team', kind: 'personal', ownerUserId: 'owner' })
    spacesRepository.addMember('space-team', 'viewer-1', 'viewer')
    spacesRepository.addMember('space-team', 'member-1', 'member')
    const app = await buildApp()
    const token = (sub: string) =>
      app.jwt.sign({
        sub,
        email: `${sub}@t`,
        name: sub,
        apps: ['vps'],
        permissions: ['vps:payments:write'],
        iss: app.authConfig.issuer,
      })
    const post = (sub: string) =>
      app.inject({
        method: 'POST',
        url: '/api/payments',
        headers: { authorization: `Bearer ${token(sub)}`, 'x-space-id': 'space-team' },
        payload: { type: 'topup', date: '2026-01-01', amount: 1 },
      })
    expect((await post('viewer-1')).statusCode).toBe(403)
    expect((await post('member-1')).statusCode).toBe(201)
    await app.close()
  })
})
