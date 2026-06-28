import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { closeDb } from '@cfdm/db'
import { resetTestDb, seedTestProvider } from '@cfdm/db/test-setup'
import { providerAccountsRepository } from '@cfdm/db/repositories/provider-accounts'
import { providersRepository } from '@cfdm/db/repositories/providers'

import { buildApp } from '../index.js'

vi.mock('../services/fourvps/sync.js', () => ({
  syncFromFourvps: vi.fn().mockResolvedValue({
    vpsCount: 2,
    paymentsCount: 0,
    tariffsCount: 3,
    newTariffs: [],
    balance: { balance: 1000, currency: 'RUB' },
    syncSummary: { added: [], updated: [], paymentsAdded: 0 },
  }),
}))

describe('sync routes — 4vps', () => {
  let app: Awaited<ReturnType<typeof buildApp>>

  beforeEach(async () => {
    resetTestDb()
    seedTestProvider('prov-4vps')
    providersRepository.update('prov-4vps', {
      apiType: '4vps',
      apiBaseUrl: 'https://4vps.su/api',
    })
    providerAccountsRepository.create({
      id: 'acc-4vps',
      providerId: 'prov-4vps',
      name: '4VPS',
      apiCredentials: '1:secret-key',
    })
    app = await buildApp()
  })

  afterEach(async () => {
    await app.close()
    closeDb()
  })

  it('POST /api/sync/:accountId syncs 4vps account', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/sync/acc-4vps',
      payload: {},
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as { ok?: boolean; synced?: { vpsCount?: number } }
    expect(body.ok).toBe(true)
    expect(body.synced?.vpsCount).toBe(2)
  })

  it('POST /api/sync/test-connection uses apiType 4vps', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ error: false, data: { userBalance: 500, serverlist: [] } }),
      }),
    )

    const res = await app.inject({
      method: 'POST',
      url: '/api/sync/test-connection',
      payload: {
        apiBaseUrl: 'https://4vps.su/api',
        apiCredentials: '1:key',
        apiType: '4vps',
      },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as { ok?: boolean }
    expect(body.ok).toBe(true)
    vi.unstubAllGlobals()
  })
})
