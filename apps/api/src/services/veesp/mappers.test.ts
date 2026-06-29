import { describe, expect, it } from 'vitest'

import { mapInvoiceToPayment, mapVpsRecordToVps } from './mappers.js'
import type { VeespVpsRecord } from './operations.js'

const baseRecord: VeespVpsRecord = {
  serviceId: '32723',
  vmId: '18867',
  service: {
    id: '32723',
    domain: 'vm.example.com',
    total: '9.99',
    status: 'Active',
    billingcycle: 'Monthly',
    next_due: '2027-06-01',
    category: 'Proxmox',
    category_url: 'virtual-private-servers',
    name: 'VPS Starter',
  },
  serviceDetail: {
    id: '32723',
    domain: 'vm.example.com',
    total: '9.99',
    billingcycle: 'Monthly',
    next_due: '2027-06-01',
    status: 'Active',
    name: 'VPS Starter',
    date_created: '2026-01-01',
  },
  vm: {
    id: '18867',
    hostname: 'vm.example.com',
    ip: '203.0.113.10',
    status: 'active',
    os: 'Debian 12',
    cpu: 2,
    ram: 4,
    disk: 80,
  },
  ips: [{ ip: '203.0.113.10', main: true }],
  info: { os: 'Debian 12', cpu: 2, ram: 4, disk: 80 },
}

describe('mapVpsRecordToVps', () => {
  it('maps veesp VPS with externalId service-vm', () => {
    const vps = mapVpsRecordToVps(baseRecord, 'prov-1', 'acc-1', 'EUR')
    expect(vps.externalId).toBe('32723-18867')
    expect(vps.ip).toBe('203.0.113.10')
    expect(vps.dns).toBe('vm.example.com')
    expect(vps.monthlyRate).toBe(9.99)
    expect(vps.tariffType).toBe('monthly')
    expect(vps.paidUntil).toBe('2027-06-01')
    expect(vps.notes).toContain('veesp-32723-18867')
  })

  it('maps suspended service to paused', () => {
    const vps = mapVpsRecordToVps(
      {
        ...baseRecord,
        service: { ...baseRecord.service, status: 'Suspended' },
      },
      'prov-1',
      'acc-1',
      'EUR',
    )
    expect(vps.status).toBe('paused')
  })

  it('uses service id when vm is absent', () => {
    const vps = mapVpsRecordToVps(
      {
        ...baseRecord,
        vmId: null,
        vm: null,
      },
      'prov-1',
      'acc-1',
      'EUR',
    )
    expect(vps.externalId).toBe('32723')
    expect(vps.notes).toContain('veesp-32723')
  })
})

describe('mapInvoiceToPayment', () => {
  it('maps paid invoice to topup payment', () => {
    const payment = mapInvoiceToPayment(
      {
        id: '308976',
        date: '2016-12-30',
        datepaid: '2016-12-30 12:40:47',
        total: '19.65',
        status: 'Paid',
        currency: 'USD',
      },
      'acc-1',
      'EUR',
    )
    expect(payment).toEqual({
      externalId: '308976',
      type: 'topup',
      date: '2016-12-30',
      amount: 19.65,
      currency: 'USD',
      providerAccountId: 'acc-1',
      vpsId: null,
      note: 'veesp-invoice-308976',
    })
  })

  it('returns null for unpaid invoice', () => {
    expect(
      mapInvoiceToPayment({ id: '1', status: 'Unpaid', total: '10' }, 'acc-1', 'EUR'),
    ).toBeNull()
  })
})
