import { describe, expect, it } from 'vitest'

import { mapVdsToVps } from './mappers.js'
import { parsePricelist, parseTariffDesc } from './parsers.js'

describe('parsePricelist', () => {
  it('parses CPU/RAM/disk from pricelist string', () => {
    expect(parsePricelist('KVM SSD Start (1 CPU/768 MB RAM/7 GB SSD)')).toEqual({
      vcpu: 1,
      ramGb: 1,
      diskGb: 7,
      diskType: 'SSD',
      virtualization: 'KVM',
    })
  })
})

describe('parseTariffDesc', () => {
  it('parses Selectel-style HTML description', () => {
    const result = parseTariffDesc('Start<br/>Процессор: 2 ядра; Память: 4 GB; Диск: 40 GB NVMe')
    expect(result.vcpu).toBe(2)
    expect(result.ramGb).toBe(4)
    expect(result.diskGb).toBe(40)
    expect(result.diskType).toBe('NVMe')
  })
})

describe('mapVdsToVps', () => {
  it('maps active VDS with monthly cost', () => {
    const vps = mapVdsToVps(
      {
        id: '42',
        ip: '203.0.113.10',
        domain: 'vps.example.com',
        item_status: '2',
        cost: '500.00 RUB / Месяц',
        pricelist: 'KVM (2 CPU/2048 MB RAM/20 GB NVMe)',
        createdate: '2024-01-15',
        expiredate: '2025-01-15',
        currency_str: 'RUB',
      },
      'prov-1',
      'acc-1',
    )
    expect(vps.externalId).toBe('42')
    expect(vps.ip).toBe('203.0.113.10')
    expect(vps.status).toBe('active')
    expect(vps.monthlyRate).toBe(500)
    expect(vps.vcpu).toBe(2)
  })
})
