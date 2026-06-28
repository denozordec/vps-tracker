import { describe, expect, it } from 'vitest'

import { mapOperationToPayment, mapServerToVps } from './mappers.js'
import type { UserApiOperation, UserApiServerDetail } from './operations.js'

const server: UserApiServerDetail = {
  id: 12345,
  name: 'Server #12345',
  full_name: 'Server 2 RAM / 1 CPU / 40 NVMe #12345',
  created: '2022-02-24',
  end: '2029-02-20',
  status: 'active',
  host: 'super.server.host',
  ip: { id: 1, ip: '91.84.101.78', type: '4' },
  template: { id: 23, name: 'Ubuntu 24.04' },
  datacenter: { id: 1, name: 'Amsterdam 1', country: 'nl' },
  'server-plan': { id: 1, name: '2 RAM / 1 CPU / 40 NVMe' },
  data: {
    cpu: { value: 1 },
    ram: { value: 2 },
    disk: { value: 40 },
    traff: { value: 32, for: 'Tb' },
  },
}

describe('mapServerToVps', () => {
  it('maps macloud server with apiType prefix in notes', () => {
    const planIndex = new Map([
      [
        '1',
        {
          id: 1,
          name: '2 RAM / 1 CPU / 40 NVMe',
          cost: 1.55,
          period: 'day',
        },
      ],
    ])
    const vps = mapServerToVps(server, 'macloud', 'prov-1', 'acc-1', planIndex)
    expect(vps.externalId).toBe('12345')
    expect(vps.ip).toBe('91.84.101.78')
    expect(vps.os).toBe('Ubuntu 24.04')
    expect(vps.vcpu).toBe(1)
    expect(vps.ramGb).toBe(2)
    expect(vps.diskGb).toBe(40)
    expect(vps.bandwidthTb).toBe(32)
    expect(vps.country).toBe('NL')
    expect(vps.paidUntil).toBe('2029-02-20')
    expect(vps.notes).toContain('macloud-12345')
    expect(vps.tariffType).toBe('daily')
    expect(vps.dailyRate).toBe(1.55)
    expect(vps.monthlyRate).toBe(46.5)
    expect(vps.currency).toBe('RUB')
  })

  it('parses string plan cost from index', () => {
    const planIndex = new Map([
      [
        '1',
        {
          id: 1,
          name: 'Plan',
          cost: '2.50',
          period: 'day',
        },
      ],
    ])
    const vps = mapServerToVps(server, 'vdsina', 'prov-1', 'acc-1', planIndex, 'USD')
    expect(vps.dailyRate).toBe(2.5)
    expect(vps.currency).toBe('USD')
  })

  it('falls back to tariff item price when plan index misses', () => {
    const tariffByPlanId = new Map([
      [
        '1',
        {
          externalId: '1',
          datacenterKey: '11',
          datacenterName: 'Cloud',
          name: 'Plan',
          desc: '',
          vcpu: 1,
          ramGb: 1,
          diskGb: 10,
          diskType: 'NVMe',
          virtualization: 'KVM',
          channel: '',
          location: 'Cloud',
          country: '',
          cpuModel: '',
          orderAvailable: true,
          price: '3 USD/day',
        },
      ],
    ])
    const vps = mapServerToVps(server, 'vdsina', 'prov-1', 'acc-1', undefined, 'USD', tariffByPlanId)
    expect(vps.dailyRate).toBe(3)
    expect(vps.monthlyRate).toBe(90)
    expect(vps.currency).toBe('USD')
  })

  it('maps monthly plan cost from plan index', () => {
    const planIndex = new Map([
      [
        '1',
        {
          id: 1,
          name: '2 RAM / 1 CPU / 40 NVMe',
          cost: 500,
          period: 'month',
        },
      ],
    ])
    const vps = mapServerToVps(server, 'vdsina', 'prov-1', 'acc-1', planIndex)
    expect(vps.tariffType).toBe('monthly')
    expect(vps.monthlyRate).toBe(500)
    expect(vps.dailyRate).toBeNull()
  })

  it('adds constructor plan extra cost from server totals', () => {
    const planIndex = new Map([
      [
        '1',
        {
          id: 1,
          name: 'Constructor',
          cost: 10,
          period: 'day',
          has_params: true,
          params: {
            cpu: { cost: 1 },
            ram: { cost: 0.5 },
            disk: { cost: 0.1 },
          },
          data: { cpu: { value: 1 }, ram: { value: 1 }, disk: { value: 1 } },
        },
      ],
    ])
    const vps = mapServerToVps(
      {
        ...server,
        data: {
          cpu: { value: 1, total: 4 },
          ram: { value: 1, total: 8 },
          disk: { value: 1, total: 10 },
        },
      },
      'vdsina',
      'prov-1',
      'acc-1',
      planIndex,
    )
    // 10 + 3*1 + 7*0.5 + 9*0.1 = 10 + 3 + 3.5 + 0.9 = 17.4
    expect(vps.dailyRate).toBe(17.4)
  })

  it('maps vdsina server with vdsina prefix in notes', () => {
    const vps = mapServerToVps(server, 'vdsina', 'prov-2', 'acc-2')
    expect(vps.notes).toContain('vdsina-12345')
  })

  it('maps paused status for notpaid', () => {
    const vps = mapServerToVps({ ...server, status: 'notpaid' }, 'macloud', 'p', 'a')
    expect(vps.status).toBe('paused')
  })
})

describe('mapOperationToPayment', () => {
  const topup: UserApiOperation = {
    id: 4290676,
    purse: 'real',
    type: 1,
    status: 1,
    summ: '100',
    created: '2025-02-22 12:28:23',
    comment: 'Balance replenishment',
  }

  it('maps paid credit to provider_balance_topup', () => {
    const payment = mapOperationToPayment(topup, 'macloud', 'acc-1')
    expect(payment).toMatchObject({
      externalId: '4290676',
      type: 'provider_balance_topup',
      amount: 100,
      date: '2025-02-22',
      note: 'Balance replenishment',
    })
  })

  it('returns null for debit operations', () => {
    expect(mapOperationToPayment({ ...topup, type: -1 }, 'vdsina', 'acc-1')).toBeNull()
  })

  it('returns null for unpaid operations', () => {
    expect(mapOperationToPayment({ ...topup, status: 0 }, 'macloud', 'acc-1')).toBeNull()
  })
})
