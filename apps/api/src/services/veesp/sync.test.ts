import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { closeDb, getSqlite } from '@cfdm/db'
import { resetTestDb } from '@cfdm/db/test-setup'
import { providerAccountsRepository } from '@cfdm/db/repositories/provider-accounts'

import { syncFromVeesp } from './sync.js'
import type { VeespSyncAccount } from './context.js'

vi.mock('./operations.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./operations.js')>()
  return {
    ...actual,
    fetchVpsRecords: vi.fn(),
    fetchBalance: vi.fn(),
    fetchTariffList: vi.fn(),
    fetchInvoices: vi.fn(),
  }
})

import { fetchBalance, fetchInvoices, fetchTariffList, fetchVpsRecords } from './operations.js'

function makeAccount(): VeespSyncAccount {
  return {
    id: 'acc-veesp',
    providerId: 'prov-veesp',
    name: 'Veesp',
    panelUrl: '',
    currency: 'EUR',
    billingMode: 'monthly',
    notes: '',
    apiType: 'veesp',
    apiBaseUrl: 'https://secure.veesp.com/api',
    apiCredentials: 'user@example.com:secret',
    apiLogin: 'user@example.com',
    apiPassword: 'secret',
    balanceApi: null,
    balanceCurrency: null,
    balanceUpdatedAt: null,
    enoughmoneyto: '',
    balanceAlertBelow: null,
    providerBaseCurrency: 'EUR',
  }
}

describe('syncFromVeesp', () => {
  beforeEach(() => {
    resetTestDb()
    getSqlite().exec(
      `INSERT INTO providers (id, name, apiType, apiBaseUrl, baseCurrency) VALUES ('prov-veesp', 'Veesp', 'veesp', 'https://secure.veesp.com/api', 'EUR')`,
    )
    providerAccountsRepository.create({
      id: 'acc-veesp',
      providerId: 'prov-veesp',
      name: 'Veesp',
      apiCredentials: 'user@example.com:secret',
    })

    vi.mocked(fetchVpsRecords).mockResolvedValue([
      {
        serviceId: '100',
        vmId: '200',
        service: {
          id: '100',
          domain: 'vps.example.com',
          total: '5.00',
          status: 'Active',
          billingcycle: 'Monthly',
          next_due: '2027-01-01',
          category: 'Proxmox',
          category_url: 'virtual-private-servers',
          name: 'VPS 1',
        },
        serviceDetail: {
          id: '100',
          total: '5.00',
          billingcycle: 'Monthly',
          next_due: '2027-01-01',
          status: 'Active',
          domain: 'vps.example.com',
          date_created: '2026-01-01',
        },
        vm: {
          id: '200',
          hostname: 'vps.example.com',
          ip: '198.51.100.1',
          status: 'active',
        },
        ips: [{ ip: '198.51.100.1', main: true }],
        info: null,
      },
    ])
    vi.mocked(fetchBalance).mockResolvedValue({
      balance: 123.45,
      currency: 'EUR',
      enoughmoneyto: '',
    })
    vi.mocked(fetchTariffList).mockResolvedValue([
      {
        externalId: '840',
        datacenterKey: '19',
        datacenterName: 'Proxmox',
        name: 'VPS',
        desc: '',
        vcpu: 0,
        ramGb: 0,
        diskGb: 0,
        diskType: 'NVMe',
        virtualization: 'KVM',
        channel: '',
        location: 'Proxmox',
        country: '',
        cpuModel: '',
        orderAvailable: true,
        price: '5.00 EUR/month',
      },
    ])
    vi.mocked(fetchInvoices).mockResolvedValue([
      {
        id: '308976',
        datepaid: '2016-12-30 12:40:47',
        total: '19.65',
        status: 'Paid',
        currency: 'EUR',
      },
    ])
  })

  afterEach(() => {
    closeDb()
  })

  it('syncs veesp account with correct id prefix', async () => {
    const result = await syncFromVeesp(makeAccount())

    expect(result.vpsCount).toBe(1)
    expect(result.paymentsCount).toBe(1)
    expect(result.tariffsCount).toBe(1)
    expect(result.balance?.balance).toBe(123.45)

    const vps = getSqlite()
      .prepare('SELECT id, notes, monthlyRate FROM vps WHERE id = ?')
      .get('vps-veesp-acc-veesp-100-200') as { id: string; notes: string; monthlyRate: number | null }
    expect(vps.notes).toContain('veesp-100-200')
    expect(vps.monthlyRate).toBe(5)
  })
})
