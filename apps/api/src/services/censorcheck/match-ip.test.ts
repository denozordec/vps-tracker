import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { closeDb, MAIN_SPACE_ID, runWithSpace } from '@cfdm/db'
import { vpsRepository } from '@cfdm/db/repositories/vps'
import { resetTestDb, seedTestProvider, seedTestProviderAccount } from '@cfdm/db/test-setup'
import { matchVpsByPublicIp, resolveProbeIp } from './match-ip.js'

describe('censorcheck match-ip', () => {
  beforeEach(() => {
    resetTestDb()
    seedTestProvider('p1')
    seedTestProviderAccount('a1', 'p1')
  })

  afterEach(() => {
    closeDb()
  })

  it('берёт claimed если observed приватный', () => {
    expect(resolveProbeIp('127.0.0.1', '203.0.113.10')).toBe('203.0.113.10')
    expect(resolveProbeIp('203.0.113.55', '203.0.113.10')).toBe('203.0.113.55')
  })

  it('матчит VPS по IPv4 и отдаёт spaceId', () => {
    const vps = runWithSpace(MAIN_SPACE_ID, () =>
      vpsRepository.create({
        ip: '203.0.113.10',
        ipv6: '2001:db8::aa',
        providerId: 'p1',
        providerAccountId: 'a1',
        status: 'active',
        tariffType: 'monthly',
        currency: 'RUB',
        vcpu: 1,
        ramGb: 1,
        diskGb: 10,
      }),
    )
    const created = Array.isArray(vps) ? vps[0]! : vps
    expect(matchVpsByPublicIp('203.0.113.10')).toEqual({
      vpsId: created.id,
      spaceId: MAIN_SPACE_ID,
    })
    expect(matchVpsByPublicIp('2001:db8::aa').vpsId).toBe(created.id)
    expect(matchVpsByPublicIp('198.51.100.1')).toEqual({
      vpsId: null,
      spaceId: MAIN_SPACE_ID,
    })
  })
})
