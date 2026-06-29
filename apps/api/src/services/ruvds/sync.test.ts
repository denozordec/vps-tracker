import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { closeDb, getSqlite } from '@cfdm/db'
import { resetTestDb } from '@cfdm/db/test-setup'
import { providerAccountsRepository } from '@cfdm/db/repositories/provider-accounts'

import { syncFromRuvds } from './sync.js'
import type { RuvdsSyncAccount } from './context.js'

vi.mock('./operations.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./operations.js')>()
  return {
    ...actual,
    fetchAllServers: vi.fn(),
    fetchBalance: vi.fn(),
    fetchTariffList: vi.fn(),
    fetchAllPayments: vi.fn(),
    fetchDatacenters: vi.fn(),
    fetchOsList: vi.fn(),
    enrichServersWithCost: vi.fn(),
  }
})

import {
  enrichServersWithCost,
  fetchAllPayments,
  fetchAllServers,
  fetchBalance,
  fetchDatacenters,
  fetchOsList,
  fetchTariffList,
} from './operations.js'

function makeAccount(): RuvdsSyncAccount {
  return {
    id: 'acc-ruvds',
    providerId: 'prov-ruvds',
    name: 'RuVDS',
    panelUrl: '',
    currency: '',
    billingMode: 'monthly',
    notes: '',
    apiType: 'ruvds',
    apiBaseUrl: 'https://api.ruvds.com',
    apiCredentials: 'apiv2.test-token',
    apiToken: 'apiv2.test-token',
    balanceApi: null,
    balanceCurrency: null,
    balanceUpdatedAt: null,
    enoughmoneyto: '',
    balanceAlertBelow: null,
    providerBaseCurrency: 'RUB',
  }
}

describe('syncFromRuvds', () => {
  beforeEach(() => {
    resetTestDb()
    getSqlite().exec(
      `INSERT INTO providers (id, name, apiType, apiBaseUrl, baseCurrency) VALUES ('prov-ruvds', 'RuVDS', 'ruvds', 'https://api.ruvds.com', 'RUB')`,
    )
    providerAccountsRepository.create({
      id: 'acc-ruvds',
      providerId: 'prov-ruvds',
      name: 'RuVDS',
      apiCredentials: 'apiv2.test-token',
    })

    vi.mocked(fetchAllServers).mockResolvedValue([
      {
        virtual_server_id: 1001,
        status: 'active',
        datacenter: 1,
        cpu: 2,
        ram: 2,
        drive: 40,
        payment_period: 2,
        os_id: 18,
        paid_till: '2027-03-01T00:00:00Z',
        user_comment: 'web',
        network_v4: [{ ip_address: '203.0.113.5' }],
      },
    ])
    vi.mocked(fetchBalance).mockResolvedValue({
      balance: 1500,
      currency: 'RUB',
      enoughmoneyto: '',
    })
    vi.mocked(fetchTariffList).mockResolvedValue([
      {
        externalId: '14',
        datacenterKey: '1',
        datacenterName: 'Moscow',
        name: 'Regular',
        desc: 'CPU 79 RUB/core',
        vcpu: 2,
        ramGb: 2,
        diskGb: 40,
        diskType: 'SSD',
        virtualization: 'KVM',
        channel: '',
        location: 'Moscow',
        country: 'RU',
        cpuModel: '',
        orderAvailable: true,
        price: '500 RUB/mo',
      },
    ])
    vi.mocked(fetchAllPayments).mockResolvedValue([
      {
        dt: '2026-01-01T00:00:00Z',
        direction: 1,
        amount: 1000,
        currency: 1,
        pay_source: 'card',
      },
    ])
    vi.mocked(fetchDatacenters).mockResolvedValue([
      { id: 1, name: 'Rucloud: Россия, Москва', country: 'RU' },
    ])
    vi.mocked(fetchOsList).mockResolvedValue([{ id: 18, name: 'Ubuntu 22.04' }])
    vi.mocked(enrichServersWithCost).mockResolvedValue(new Map([[1001, 500]]))
  })

  afterEach(() => {
    closeDb()
  })

  it('syncs vps, balance, payments and tariffs', async () => {
    const result = await syncFromRuvds(makeAccount())
    expect(result.vpsCount).toBe(1)
    expect(result.paymentsCount).toBe(1)
    expect(result.tariffsCount).toBe(1)
    expect(result.balance?.balance).toBe(1500)
    expect(result.syncSummary.added).toHaveLength(1)
    expect(result.syncSummary.added[0].id).toBe('vps-ruvds-acc-ruvds-1001')
  })

  it('updates existing vps by notes marker', async () => {
    await syncFromRuvds(makeAccount())
    vi.mocked(fetchAllServers).mockResolvedValue([
      {
        virtual_server_id: 1001,
        status: 'active',
        datacenter: 1,
        cpu: 4,
        ram: 4,
        drive: 80,
        payment_period: 2,
        os_id: 18,
        paid_till: '2028-01-01T00:00:00Z',
        network_v4: [{ ip_address: '203.0.113.5' }],
      },
    ])
    vi.mocked(enrichServersWithCost).mockResolvedValue(new Map([[1001, 800]]))

    const result = await syncFromRuvds(makeAccount())
    expect(result.vpsCount).toBe(1)
    expect(result.syncSummary.updated.length).toBeGreaterThan(0)
  })
})
