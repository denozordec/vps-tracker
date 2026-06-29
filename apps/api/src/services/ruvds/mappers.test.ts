import { describe, expect, it } from 'vitest'

import { buildLookupMaps, mapPaymentToPayment, mapServerToVps } from './mappers.js'
import type { RuvdsPayment, RuvdsServer } from './types.js'

const server: RuvdsServer = {
  virtual_server_id: 38420,
  status: 'active',
  datacenter: 1,
  cpu: 2,
  ram: 4,
  drive: 40,
  payment_period: 3,
  os_id: 18,
  paid_till: '2027-06-15T12:00:00Z',
  user_comment: 'Prod VPS',
  network_v4: [{ ip_address: '198.51.100.10' }, { ip_address: '198.51.100.11' }],
}

const lookups = buildLookupMaps(
  [{ id: 1, name: 'Rucloud: Россия, Москва', country: 'RU' }],
  [{ id: 18, name: 'Ubuntu 22.04' }],
  new Map([[38420, 900]]),
)

describe('mapServerToVps', () => {
  it('maps server fields and notes marker', () => {
    const vps = mapServerToVps(server, 'prov-ruvds', 'acc-ruvds', 'RUB', lookups)
    expect(vps.externalId).toBe('38420')
    expect(vps.ip).toBe('198.51.100.10')
    expect(vps.additionalIps).toEqual(['198.51.100.11'])
    expect(vps.vcpu).toBe(2)
    expect(vps.ramGb).toBe(4)
    expect(vps.diskGb).toBe(40)
    expect(vps.paidUntil).toBe('2027-06-15')
    expect(vps.os).toBe('Ubuntu 22.04')
    expect(vps.monthlyRate).toBe(300)
    expect(vps.notes).toContain('ruvds-38420')
    expect(vps.datacenter).toContain('Rucloud')
  })
})

describe('mapPaymentToPayment', () => {
  it('maps income payments only', () => {
    const payment: RuvdsPayment = {
      dt: '2026-01-10T10:00:00Z',
      direction: 1,
      amount: 500,
      currency: 1,
      pay_source: 'card',
    }
    const mapped = mapPaymentToPayment(payment, 'acc-ruvds', 'RUB')
    expect(mapped).not.toBeNull()
    expect(mapped?.type).toBe('topup')
    expect(mapped?.amount).toBe(500)
    expect(mapped?.currency).toBe('RUB')
    expect(mapped?.note).toContain('ruvds-')
  })

  it('skips debit payments', () => {
    const payment: RuvdsPayment = {
      dt: '2026-01-10T10:00:00Z',
      direction: 2,
      amount: 100,
      currency: 1,
    }
    expect(mapPaymentToPayment(payment, 'acc-ruvds', 'RUB')).toBeNull()
  })
})
