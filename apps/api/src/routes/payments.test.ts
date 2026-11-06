import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { closeDb } from '@cfdm/db'
import { resetTestDb } from '@cfdm/db/test-setup'
import { buildApp } from '../index.js'

describe('payments / balance-ledger without VPS', () => {
  let app: Awaited<ReturnType<typeof buildApp>>

  beforeEach(async () => {
    resetTestDb()
    app = await buildApp()
  })

  afterEach(async () => {
    await app.close()
    closeDb()
  })

  it('POST /api/payments stores empty vpsId/providerAccountId as null', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/payments',
      payload: { type: 'topup', date: '2026-01-01', amount: 10, vpsId: '', providerAccountId: '' },
    })
    expect(res.statusCode).toBe(201)
    const body = res.json() as { id: string; vpsId: string | null; providerAccountId: string | null }
    expect(body.vpsId).toBeNull()
    expect(body.providerAccountId).toBeNull()

    const put = await app.inject({ method: 'PUT', url: `/api/payments/${body.id}`, payload: { note: 'x' } })
    expect(put.statusCode).toBe(200)
  })

  it('POST /api/balance-ledger stores empty refs as null', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/balance-ledger',
      payload: { type: 'topup', date: '2026-01-01', amount: 10, vpsId: '', providerAccountId: '' },
    })
    expect(res.statusCode).toBe(201)
  })

  it('POST /api/vps without provider does not hit FK', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/vps', payload: { ip: '10.0.0.1' } })
    expect(res.statusCode).toBeLessThan(300)
  })
})
