import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { closeDb, getSqlite } from '@cfdm/db'
import { resetTestDb } from '@cfdm/db/test-setup'
import { providerAccountsRepository } from '@cfdm/db/repositories/provider-accounts'

import { syncFromFourvps } from './sync.js'
import type { FourvpsSyncAccount } from './context.js'

vi.mock('./operations.js', () => ({
  fetchMyServers: vi.fn(),
  fetchUserBalance: vi.fn(),
  fetchTarifList: vi.fn(),
  fetchDcList: vi.fn(),
}))

import {
  fetchDcList,
  fetchMyServers,
  fetchTarifList,
  fetchUserBalance,
} from './operations.js'

const account: FourvpsSyncAccount = {
  id: 'acc-4vps',
  spaceId: 'space-main',
  providerId: 'prov-4vps',
  name: '4VPS Account',
  panelUrl: '',
  currency: 'RUB',
  billingMode: 'monthly',
  notes: '',
  apiType: '4vps',
  apiBaseUrl: 'https://4vps.su/api',
  apiCredentials: '1:secret',
  panelId: 1,
  apiKey: 'secret',
  balanceApi: null,
  balanceCurrency: null,
  balanceUpdatedAt: null,
  enoughmoneyto: '',
  balanceAlertBelow: null,
}

describe('syncFromFourvps', () => {
  beforeEach(() => {
    resetTestDb()
    getSqlite()
      .prepare(
        `INSERT INTO providers (id, name, apiType, apiBaseUrl) VALUES ('prov-4vps', '4VPS', '4vps', 'https://4vps.su/api')`,
      )
      .run()
    providerAccountsRepository.create({
      id: 'acc-4vps',
      providerId: 'prov-4vps',
      name: '4VPS Account',
      apiCredentials: '1:secret',
    })

    vi.mocked(fetchMyServers).mockResolvedValue([
      {
        id: 100,
        name: 'srv1',
        price: 420,
        dc: 1,
        image: 'Debian 11',
        mem: 2,
        cpu: 2,
        disk: 20,
        ipv4: '1.2.3.4',
        status: 'active',
        tname: 'cx01',
        time: 1664275501,
        expired: 1666781101,
      },
    ])
    vi.mocked(fetchUserBalance).mockResolvedValue({ balance: 77825, currency: 'RUB' })
    vi.mocked(fetchDcList).mockResolvedValue(
      new Map([[1, { id: 1, dc_name: 'AE DC1', flag: 'ae' }]]),
    )
    vi.mocked(fetchTarifList).mockResolvedValue([
      {
        externalId: '13',
        datacenterKey: '1',
        datacenterName: 'AE DC1',
        name: 'AE-cx01',
        desc: '',
        vcpu: 1,
        ramGb: 1,
        diskGb: 10,
        diskType: 'NVME',
        virtualization: 'KVM',
        channel: '1Gbit/s',
        location: 'AE DC1',
        country: 'AE',
        cpuModel: 'E5',
        orderAvailable: true,
        price: '420',
      },
    ])
  })

  afterEach(() => {
    closeDb()
    vi.clearAllMocks()
  })

  it('upserts VPS, balance and tariffs', async () => {
    const result = await syncFromFourvps(account)

    expect(result.vpsCount).toBe(1)
    expect(result.paymentsCount).toBe(0)
    expect(result.tariffsCount).toBe(1)
    expect(result.balance?.balance).toBe(77825)

    const vps = getSqlite()
      .prepare(`SELECT id, ip FROM vps WHERE providerAccountId = ?`)
      .get('acc-4vps') as { id: string; ip: string }
    expect(vps.id).toBe('vps-4vps-acc-4vps-100')
    expect(vps.ip).toBe('1.2.3.4')

    const tariffs = getSqlite()
      .prepare(`SELECT COUNT(*) as c FROM active_tariffs WHERE providerAccountId = ?`)
      .get('acc-4vps') as { c: number }
    expect(tariffs.c).toBe(1)

    const bal = getSqlite()
      .prepare(`SELECT balance_api FROM provider_accounts WHERE id = ?`)
      .get('acc-4vps') as { balance_api: number }
    expect(bal.balance_api).toBe(77825)
  })
})
