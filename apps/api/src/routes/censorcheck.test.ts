import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { closeDb, MAIN_SPACE_ID, runWithSpace } from '@cfdm/db'
import { vpsRepository } from '@cfdm/db/repositories/vps'
import { resetTestDb, seedTestProvider, seedTestProviderAccount } from '@cfdm/db/test-setup'
import { buildApp } from '../index.js'
import { mintIngestToken } from '../services/censorcheck/ingest-token.js'

const SECRET = 'test-censorcheck-ingest-secret'

function ingestPayload(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: 1,
    runId: '11111111-1111-4111-8111-111111111111',
    probe: { publicIp: '203.0.113.10' },
    launcherVersion: '1',
    censorcheck: { version: '1', mode: 'both' },
    results: [
      {
        service: 'youtube.com',
        raw: { https: { ipv4: { status: 200 } } },
      },
    ],
    ...overrides,
  }
}

describe('censorcheck ingest + reads', () => {
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
      url: '/api/integrations/censorcheck/runs',
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
      url: '/api/integrations/censorcheck/runs',
      payload: ingestPayload(),
    })
    expect(res.statusCode).toBe(401)
  })

  it('отклоняет просроченный токен', async () => {
    const token = mintIngestToken(SECRET, 60, Date.now() - 120_000)
    const res = await post(ingestPayload(), token)
    expect(res.statusCode).toBe(401)
  })

  it('отклоняет невалидный payload', async () => {
    const res = await post({ schemaVersion: 1, runId: 'short' })
    expect(res.statusCode).toBe(400)
  })

  it('принимает прогон и оставляет unmatched', async () => {
    const res = await post(ingestPayload())
    expect(res.statusCode).toBe(200)
    const json = res.json() as { matchedVpsId: string | null; probePublicIp: string }
    expect(json.matchedVpsId).toBeNull()
    expect(json.probePublicIp).toBe('203.0.113.10')
  })

  it('матчит VPS по IPv4 и IPv6', async () => {
    const vps = runWithSpace(MAIN_SPACE_ID, () =>
      vpsRepository.create({
        ip: '203.0.113.10',
        ipv6: '2001:db8::55',
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
    const v4 = await post(ingestPayload({ runId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }))
    expect(v4.json().matchedVpsId).toBe(vps.id)

    const v6 = await post(
      ingestPayload({
        runId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        probe: { publicIp: '2001:db8::55' },
      }),
    )
    expect(v6.json().matchedVpsId).toBe(vps.id)
  })

  it('повторяет duplicate runId без второй записи', async () => {
    const first = await post(ingestPayload())
    const second = await post(ingestPayload())
    expect(first.statusCode).toBe(200)
    expect(second.statusCode).toBe(200)
    expect(second.json().id).toBe(first.json().id)
    expect(second.json().replayed).toBe(true)

    const current = await app.inject({ method: 'GET', url: '/api/censorcheck/current' })
    expect(current.json().items).toHaveLength(1)
  })

  it('берёт observed XFF, а claimed сохраняет если расходится', async () => {
    runWithSpace(MAIN_SPACE_ID, () =>
      vpsRepository.create({
        ip: '198.51.100.20',
        providerId: 'p1',
        providerAccountId: 'a1',
        status: 'active',
        tariffType: 'monthly',
        currency: 'RUB',
        vcpu: 1,
        ramGb: 1,
        diskGb: 10,
      }),
    )
    const res = await post(ingestPayload({
      runId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      probe: { publicIp: '203.0.113.10' },
    }), undefined, { 'x-forwarded-for': '198.51.100.20' })
    const json = res.json() as { probePublicIp: string; matchedVpsId: string | null }
    expect(json.probePublicIp).toBe('198.51.100.20')
    expect(json.matchedVpsId).not.toBeNull()

    const current = await app.inject({ method: 'GET', url: '/api/censorcheck/current' })
    expect(current.json().items[0].claimedPublicIp).toBe('203.0.113.10')
  })

  it('отдаёт историю и детали', async () => {
    await post(ingestPayload())
    const list = await app.inject({ method: 'GET', url: '/api/censorcheck/runs?limit=10' })
    expect(list.statusCode).toBe(200)
    const items = list.json().items as Array<{ id: string }>
    expect(items).toHaveLength(1)
    const detail = await app.inject({ method: 'GET', url: `/api/censorcheck/runs/${items[0]!.id}` })
    expect(detail.statusCode).toBe(200)
    expect(detail.json().results).toHaveLength(1)
  })
})
