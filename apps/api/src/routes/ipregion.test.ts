import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { closeDb, MAIN_SPACE_ID, runWithSpace } from '@cfdm/db'
import { vpsRepository } from '@cfdm/db/repositories/vps'
import { resetTestDb, seedTestProvider, seedTestProviderAccount } from '@cfdm/db/test-setup'
import { buildApp } from '../index.js'
import { mintIngestToken } from '../services/censorcheck/ingest-token.js'

const SECRET = 'test-ipregion-ingest-secret'

function ingestPayload(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: 1,
    runId: '11111111-1111-4111-8111-111111111111',
    probe: { publicIp: '203.0.113.10' },
    launcherVersion: '1',
    ipregion: { version: '1' },
    results: [
      {
        service: 'maxmind.com',
        group: 'primary',
        ipv4: 'NL',
        ipv6: 'N/A',
      },
      {
        service: 'Google',
        group: 'custom',
        ipv4: 'US',
        ipv6: null,
      },
    ],
    ...overrides,
  }
}

describe('ipregion ingest + reads', () => {
  let app: Awaited<ReturnType<typeof buildApp>>

  beforeEach(async () => {
    process.env.CENSORCHECK_INGEST_SECRET = SECRET
    process.env.CENSORCHECK_RATE_LIMIT = '0'
    process.env.TRUST_PROXY = '1'
    resetTestDb()
    seedTestProvider('p1')
    seedTestProviderAccount('a1', 'p1')
    app = await buildApp()
  })

  afterEach(async () => {
    await app.close()
    closeDb()
    delete process.env.TRUST_PROXY
  })

  async function post(body: unknown, token?: string, headers: Record<string, string> = {}) {
    return app.inject({
      method: 'POST',
      url: '/api/integrations/ipregion/runs',
      headers: {
        authorization: `Bearer ${token ?? mintIngestToken(SECRET)}`,
        'content-type': 'application/json',
        ...headers,
      },
      payload: body as object,
    })
  }

  it('отклоняет запрос без токена', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/integrations/ipregion/runs',
      payload: ingestPayload(),
    })
    expect(res.statusCode).toBe(401)
  })

  it('принимает прогон и оставляет unmatched', async () => {
    const res = await post(ingestPayload())
    expect(res.statusCode).toBe(200)
    const json = res.json() as { matchedVpsId: string | null; probePublicIp: string }
    expect(json.matchedVpsId).toBeNull()
    expect(json.probePublicIp).toBe('203.0.113.10')
  })

  it('матчит VPS по IP', async () => {
    const vps = runWithSpace(MAIN_SPACE_ID, () =>
      vpsRepository.create({
        ip: '203.0.113.10',
        dns: 'edge.example.com',
        providerId: 'p1',
        providerAccountId: 'a1',
        status: 'active',
        tariffType: 'monthly',
        currency: 'RUB',
        vcpu: 2,
        ramGb: 4,
        diskGb: 40,
      }),
    )
    const res = await post(ingestPayload({ runId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }))
    expect(res.json().matchedVpsId).toBe(vps.id)
  })

  it('повторяет duplicate runId без второй записи', async () => {
    const first = await post(ingestPayload())
    const second = await post(ingestPayload())
    expect(second.json().id).toBe(first.json().id)
    expect(second.json().replayed).toBe(true)

    const current = await app.inject({ method: 'GET', url: '/api/ipregion/current' })
    expect(current.json().items).toHaveLength(1)
  })

  it('отдаёт историю и детали с ISO', async () => {
    await post(ingestPayload())
    const list = await app.inject({ method: 'GET', url: '/api/ipregion/runs?limit=10' })
    expect(list.statusCode).toBe(200)
    const items = list.json().items as Array<{
      id: string
      results?: Array<{ countryIpv4: string; status: string; group: string }>
    }>
    expect(items).toHaveLength(1)
    expect(items[0]!.results).toHaveLength(2)
    expect(items[0]!.results?.[0]).toMatchObject({
      countryIpv4: 'NL',
      status: 'ok',
      group: 'primary',
    })
    const detail = await app.inject({ method: 'GET', url: `/api/ipregion/runs/${items[0]!.id}` })
    expect(detail.statusCode).toBe(200)
    expect(detail.json().results).toHaveLength(2)
  })

  it('сохраняет хостер из probe', async () => {
    await post(
      ingestPayload({
        runId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
        probe: { publicIp: '203.0.113.10', hoster: 'AS14061 DigitalOcean, LLC' },
      }),
    )
    const current = await app.inject({ method: 'GET', url: '/api/ipregion/current' })
    expect(current.json().items[0].detectedHoster).toBe('DigitalOcean')
  })

  it('принимает results как объект с числовыми ключами (RouterOS serialize)', async () => {
    const res = await post(
      ingestPayload({
        schemaVersion: '1',
        runId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        results: {
          '0': { service: 'maxmind.com', ipv4: 'NL' },
          '1': { service: 'ipinfo.io', ipv4: 'RU' },
        },
      }),
    )
    expect(res.statusCode).toBe(200)
    expect(res.json().summary.ok).toBe(2)
  })
})
