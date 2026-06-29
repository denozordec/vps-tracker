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

vi.mock('../services/userapi/sync.js', () => ({
  syncFromUserApi: vi.fn().mockResolvedValue({
    vpsCount: 1,
    paymentsCount: 1,
    tariffsCount: 2,
    newTariffs: [],
    balance: { balance: 500, currency: 'RUB', enoughmoneyto: '2029-01-01' },
    syncSummary: { added: [], updated: [], paymentsAdded: 1 },
  }),
}))

vi.mock('../services/veesp/sync.js', () => ({
  syncFromVeesp: vi.fn().mockResolvedValue({
    vpsCount: 2,
    paymentsCount: 1,
    tariffsCount: 1,
    newTariffs: [],
    balance: { balance: 123.45, currency: 'EUR', enoughmoneyto: '' },
    syncSummary: { added: [], updated: [], paymentsAdded: 1 },
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

describe('sync routes — macloud', () => {
  let app: Awaited<ReturnType<typeof buildApp>>

  beforeEach(async () => {
    resetTestDb()
    seedTestProvider('prov-macloud')
    providersRepository.update('prov-macloud', {
      apiType: 'macloud',
      apiBaseUrl: 'https://userapi.macloud.ru/v1',
    })
    providerAccountsRepository.create({
      id: 'acc-macloud',
      providerId: 'prov-macloud',
      name: 'Macloud',
      apiCredentials: 'secret-token',
    })
    app = await buildApp()
  })

  afterEach(async () => {
    await app.close()
    closeDb()
  })

  it('POST /api/sync/:accountId syncs macloud account', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/sync/acc-macloud',
      payload: {},
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as { ok?: boolean; synced?: { vpsCount?: number } }
    expect(body.ok).toBe(true)
    expect(body.synced?.vpsCount).toBe(1)
  })

  it('POST /api/sync/test-connection uses apiType macloud', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          status: 'ok',
          status_msg: 'Account information',
          data: { forecast: '2029-01-01' },
        }),
      }),
    )

    const res = await app.inject({
      method: 'POST',
      url: '/api/sync/test-connection',
      payload: {
        apiBaseUrl: 'https://userapi.macloud.ru/v1',
        apiCredentials: 'token',
        apiType: 'macloud',
      },
    })
    expect(res.statusCode).toBe(200)
    expect((res.json() as { ok?: boolean }).ok).toBe(true)
    vi.unstubAllGlobals()
  })
})

describe('sync routes — vdsina', () => {
  let app: Awaited<ReturnType<typeof buildApp>>

  beforeEach(async () => {
    resetTestDb()
    seedTestProvider('prov-vdsina')
    providersRepository.update('prov-vdsina', {
      apiType: 'vdsina',
      apiBaseUrl: 'https://userapi.vdsina.com/v1',
    })
    providerAccountsRepository.create({
      id: 'acc-vdsina',
      providerId: 'prov-vdsina',
      name: 'VDSina',
      apiCredentials: 'secret-token',
    })
    app = await buildApp()
  })

  afterEach(async () => {
    await app.close()
    closeDb()
  })

  it('POST /api/sync/:accountId syncs vdsina account', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/sync/acc-vdsina',
      payload: {},
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as { ok?: boolean; synced?: { vpsCount?: number } }
    expect(body.ok).toBe(true)
    expect(body.synced?.vpsCount).toBe(1)
  })
})

describe('sync routes — veesp', () => {
  let app: Awaited<ReturnType<typeof buildApp>>

  beforeEach(async () => {
    resetTestDb()
    seedTestProvider('prov-veesp')
    providersRepository.update('prov-veesp', {
      apiType: 'veesp',
      apiBaseUrl: 'https://secure.veesp.com/api',
    })
    providerAccountsRepository.create({
      id: 'acc-veesp',
      providerId: 'prov-veesp',
      name: 'Veesp',
      apiCredentials: 'user@example.com:secret',
    })
    app = await buildApp()
  })

  afterEach(async () => {
    await app.close()
    closeDb()
  })

  it('POST /api/sync/:accountId syncs veesp account', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/sync/acc-veesp',
      payload: {},
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as { ok?: boolean; synced?: { vpsCount?: number } }
    expect(body.ok).toBe(true)
    expect(body.synced?.vpsCount).toBe(2)
  })

  it('POST /api/sync/test-connection uses apiType veesp', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async (url: string) => {
        const path = String(url)
        if (path.includes('/login')) {
          return { ok: true, json: async () => ({ token: 'jwt' }) }
        }
        if (path.includes('/balance')) {
          return {
            ok: true,
            json: async () => ({
              details: { currency: 'EUR', acc_balance: '100.00', acc_credit: '0.00' },
            }),
          }
        }
        if (path.includes('/category')) {
          return { ok: true, json: async () => ({ categories: [] }) }
        }
        if (path.includes('/service')) {
          return { ok: true, json: async () => ({ services: [] }) }
        }
        return { ok: true, json: async () => ({}) }
      }),
    )

    const res = await app.inject({
      method: 'POST',
      url: '/api/sync/test-connection',
      payload: {
        apiBaseUrl: 'https://secure.veesp.com/api',
        apiCredentials: 'user@example.com:secret',
        apiType: 'veesp',
      },
    })
    expect(res.statusCode).toBe(200)
    expect((res.json() as { ok?: boolean }).ok).toBe(true)
    vi.unstubAllGlobals()
  })
})
