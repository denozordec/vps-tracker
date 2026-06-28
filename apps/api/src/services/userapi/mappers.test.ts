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
    const vps = mapServerToVps(server, 'macloud', 'prov-1', 'acc-1')
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
