import { describe, expect, it } from 'vitest'

import { mapServerToVps } from './mappers.js'
import type { FourVpsServer } from './operations.js'

const sampleServer: FourVpsServer = {
  id: 4140,
  name: 'MyFirstServer',
  price: 420,
  dc: 7,
  image: 'Alma Linux 8',
  mem: 1,
  cpu: 1,
  disk: 10,
  ipv4: '185.143.223.29',
  status: 'active',
  tname: 'USA-cx01',
  time: 1664275501,
  expired: 1666781101,
}

describe('mapServerToVps', () => {
  it('maps myservers fields to VPS model', () => {
    const dcMap = new Map([
      [7, { id: 7, dc_name: 'USA DC1', flag: 'us', cpu_name: 'E5' }],
    ])
    const vps = mapServerToVps(sampleServer, 'prov-1', 'acc-1', dcMap)

    expect(vps.externalId).toBe('4140')
    expect(vps.ip).toBe('185.143.223.29')
    expect(vps.vcpu).toBe(1)
    expect(vps.ramGb).toBe(1)
    expect(vps.diskGb).toBe(10)
    expect(vps.os).toBe('Alma Linux 8')
    expect(vps.status).toBe('active')
    expect(vps.monthlyRate).toBe(420)
    expect(vps.datacenter).toBe('USA DC1')
    expect(vps.country).toBe('US')
    expect(vps.paidUntil).toBe('2022-10-26')
    expect(vps.notes).toContain('4vps-4140')
  })
})
