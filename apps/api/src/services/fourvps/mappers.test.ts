import { describe, expect, it } from 'vitest'

import { parseFourVpsDcLocation } from './location.js'
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

describe('parseFourVpsDcLocation', () => {
  it('parses UAE DC ordinal → country only', () => {
    expect(parseFourVpsDcLocation('ОАЭ ДЦ1', 'ae')).toEqual({
      country: 'ОАЭ',
      city: '',
    })
    expect(parseFourVpsDcLocation('AE DC1', 'ae')).toEqual({
      country: 'ОАЭ',
      city: '',
    })
  })

  it('parses USA DC1 → США', () => {
    expect(parseFourVpsDcLocation('USA DC1', 'us')).toEqual({
      country: 'США',
      city: '',
    })
  })

  it('parses country + city', () => {
    expect(parseFourVpsDcLocation('Нидерланды Амстердам', 'nl')).toEqual({
      country: 'Нидерланды',
      city: 'Амстердам',
    })
    expect(parseFourVpsDcLocation('Германия, Франкфурт', 'de')).toEqual({
      country: 'Германия',
      city: 'Франкфурт',
    })
  })
})

describe('mapServerToVps', () => {
  it('maps myservers fields to VPS model with country/city from DC', () => {
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
    expect(vps.country).toBe('США')
    expect(vps.city).toBe('')
    expect(vps.paidUntil).toBe('2022-10-26')
    expect(vps.notes).toContain('4vps-4140')
  })

  it('falls back to tname prefix when DC map empty', () => {
    const vps = mapServerToVps(sampleServer, 'prov-1', 'acc-1', new Map())
    expect(vps.country).toBe('США')
    expect(vps.datacenter).toBe('7')
  })
})
