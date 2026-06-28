import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { closeDb, getSqlite } from '@cfdm/db'
import { resetTestDb } from '@cfdm/db/test-setup'
import { providerAccountsRepository } from '@cfdm/db/repositories/provider-accounts'

import { syncFromUserApi } from './sync.js'
import type { UserApiSyncAccount } from './context.js'

vi.mock('./operations.js', () => ({
  fetchServersWithDetails: vi.fn(),
  fetchBalance: vi.fn(),
  fetchTariffList: vi.fn(),
  fetchPlanCostIndex: vi.fn(),
  fetchOperations: vi.fn(),
}))

import {
  fetchBalance,
  fetchOperations,
  fetchPlanCostIndex,
  fetchServersWithDetails,
  fetchTariffList,
} from './operations.js'

function makeAccount(apiType: 'macloud' | 'vdsina'): UserApiSyncAccount {
  return {
    id: `acc-${apiType}`,
    providerId: `prov-${apiType}`,
    name: `${apiType} Account`,
    panelUrl: '',
    currency: 'RUB',
    billingMode: 'daily',
    notes: '',
    apiType,
    apiBaseUrl:
      apiType === 'macloud'
        ? 'https://userapi.macloud.ru/v1'
        : 'https://userapi.vdsina.com/v1',
    apiCredentials: 'secret-token',
    apiToken: 'secret-token',
    balanceApi: null,
    balanceCurrency: null,
    balanceUpdatedAt: null,
    enoughmoneyto: '',
    balanceAlertBelow: null,
  }
}

describe('syncFromUserApi', () => {
  beforeEach(() => {
    resetTestDb()
    vi.mocked(fetchServersWithDetails).mockResolvedValue([
      {
        id: 100,
        name: 'Server #100',
        status: 'active',
        end: '2029-01-01',
        ip: { ip: '1.2.3.4', type: '4' },
        template: { name: 'Debian 12' },
        datacenter: { id: 1, name: 'DC1', country: 'ru' },
        'server-plan': { id: 13, name: '2 RAM / 1 CPU / 40 NVMe' },
        data: { cpu: { value: 1 }, ram: { value: 2 }, disk: { value: 40 } },
      },
    ])
    vi.mocked(fetchBalance).mockResolvedValue({
      balance: 500,
      currency: 'RUB',
      enoughmoneyto: '2029-12-01',
    })
    vi.mocked(fetchTariffList).mockResolvedValue([
      {
        externalId: '13',
        datacenterKey: '11',
        datacenterName: 'Cloud',
        name: '2 RAM / 1 CPU / 40 NVMe',
        desc: '',
        vcpu: 1,
        ramGb: 2,
        diskGb: 40,
        diskType: 'NVMe',
        virtualization: 'KVM',
        channel: '',
        location: 'Cloud',
        country: '',
        cpuModel: '',
        orderAvailable: true,
        price: '1.55 ₽/день',
      },
    ])
    vi.mocked(fetchPlanCostIndex).mockResolvedValue(
      new Map([
        [
          '13',
          {
            id: 13,
            name: '2 RAM / 1 CPU / 40 NVMe',
            cost: 1.55,
            period: 'day',
          },
        ],
      ]),
    )
    vi.mocked(fetchOperations).mockResolvedValue([
      {
        id: 999,
        purse: 'real',
        type: 1,
        status: 1,
        summ: '200',
        created: '2025-03-01 10:00:00',
        comment: 'Top up',
      },
    ])
  })

  afterEach(() => {
    closeDb()
  })

  it('syncs macloud account with correct id prefix', async () => {
    getSqlite()
      .prepare(
        `INSERT INTO providers (id, name, apiType, apiBaseUrl) VALUES ('prov-macloud', 'Macloud', 'macloud', 'https://userapi.macloud.ru/v1')`,
      )
      .run()
    providerAccountsRepository.create({
      id: 'acc-macloud',
      providerId: 'prov-macloud',
      name: 'Macloud',
      apiCredentials: 'secret-token',
    })

    const result = await syncFromUserApi(makeAccount('macloud'))

    expect(result.vpsCount).toBe(1)
    expect(result.paymentsCount).toBe(1)
    expect(result.tariffsCount).toBe(1)
    expect(result.balance?.balance).toBe(500)

    const vps = getSqlite().prepare('SELECT id, notes, dailyRate, tariffType FROM vps WHERE id = ?').get('vps-macloud-acc-macloud-100') as {
      id: string
      notes: string
      dailyRate: number
      tariffType: string
    }
    expect(vps.notes).toContain('macloud-100')
    expect(vps.dailyRate).toBe(1.55)
    expect(vps.tariffType).toBe('daily')
  })

  it('syncs vdsina account with vdsina id prefix', async () => {
    getSqlite()
      .prepare(
        `INSERT INTO providers (id, name, apiType, apiBaseUrl) VALUES ('prov-vdsina', 'VDSina', 'vdsina', 'https://userapi.vdsina.com/v1')`,
      )
      .run()
    providerAccountsRepository.create({
      id: 'acc-vdsina',
      providerId: 'prov-vdsina',
      name: 'VDSina',
      apiCredentials: 'secret-token',
    })

    const result = await syncFromUserApi(makeAccount('vdsina'))

    expect(result.vpsCount).toBe(1)
    const vps = getSqlite().prepare('SELECT id FROM vps WHERE id = ?').get('vps-vdsina-acc-vdsina-100')
    expect(vps).toBeTruthy()
  })
})
