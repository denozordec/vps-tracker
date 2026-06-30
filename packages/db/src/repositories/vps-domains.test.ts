import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { closeDb } from '../index.js'
import { vpsRepository } from './vps.js'
import { vpsDomainsRepository } from './vps-domains.js'
import { settingsRepository } from './settings.js'
import { resetTestDb, seedTestProvider, seedTestProviderAccount } from '../test-setup.js'

describe('vpsDomainsRepository', () => {
  beforeEach(() => {
    resetTestDb()
    seedTestProvider('p1')
    seedTestProviderAccount('a1', 'p1')
  })

  afterEach(() => {
    closeDb()
  })

  it('привязывает домен к VPS по IP', () => {
    const vps = vpsRepository.create({
      ip: '203.0.113.10',
      providerId: 'p1',
      providerAccountId: 'a1',
      status: 'active',
      tariffType: 'monthly',
      currency: 'RUB',
      vcpu: 1,
      ramGb: 1,
      diskGb: 10,
    })
    const created = Array.isArray(vps) ? vps[0]! : vps

    const result = vpsDomainsRepository.syncBindings([
      {
        bindingId: 1,
        serviceId: 10,
        serviceName: 'VPN Node',
        serviceSlug: 'vpn-node',
        fqdn: 'vpn.example.com',
        zoneName: 'example.com',
        hostname: 'vpn',
        ips: ['203.0.113.10'],
      },
    ])

    expect(result.upserted).toBe(1)
    expect(result.matched).toBe(1)
    const domains = vpsDomainsRepository.listByVpsId(created.id)
    expect(domains).toHaveLength(1)
    expect(domains[0]?.fqdn).toBe('vpn.example.com')
    expect(domains[0]?.matchStatus).toBe('matched')
  })

  it('помечает unmatched без совпадения IP', () => {
    const result = vpsDomainsRepository.syncBindings([
      {
        bindingId: 2,
        serviceId: 11,
        serviceName: 'CDN',
        serviceSlug: 'cdn',
        fqdn: 'cdn.example.com',
        zoneName: 'example.com',
        hostname: 'cdn',
        ips: ['198.51.100.1'],
      },
    ])
    expect(result.unmatched).toBe(1)
    expect(vpsDomainsRepository.listUnmatched()).toHaveLength(1)
  })
})

describe('settingsRepository integration fields', () => {
  beforeEach(() => {
    resetTestDb()
  })

  afterEach(() => {
    closeDb()
  })

  it('маскирует integration token в DTO', () => {
    settingsRepository.upsert('settings-main', {
      integrationToken: 'secret-token-value',
      integrationEnabled: true,
    })
    const dto = settingsRepository.get('settings-main')
    expect(dto?.integrationTokenSet).toBe(true)
    expect(dto).not.toHaveProperty('integrationToken')
  })
})
