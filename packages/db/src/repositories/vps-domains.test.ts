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

  it('привязывает CNAME по cnameTarget → VPS.dns', () => {
    const vps = vpsRepository.create({
      ip: '203.0.113.20',
      dns: 'ihome.rkns.top',
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
        bindingId: 3,
        serviceId: 12,
        serviceName: 'MSK IHOR Node',
        serviceSlug: 'msk-ihor',
        fqdn: 'imsk.rkns.top',
        zoneName: 'rkns.top',
        hostname: 'imsk',
        ips: ['ihome.rkns.top'],
        cnameTarget: 'ihome.rkns.top',
      },
    ])

    expect(result.matched).toBe(1)
    expect(result.unmatched).toBe(0)
    const domains = vpsDomainsRepository.listByVpsId(created.id)
    expect(domains[0]?.fqdn).toBe('imsk.rkns.top')
    expect(domains[0]?.matchStatus).toBe('matched')
  })

  it('наследует VPS от sibling binding того же сервиса', () => {
    const vps = vpsRepository.create({
      ip: '203.0.113.30',
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
        bindingId: 4,
        serviceId: 20,
        serviceName: 'MSK Macloud',
        serviceSlug: 'msk-macloud',
        fqdn: 'home.rkns.top',
        zoneName: 'rkns.top',
        hostname: 'home',
        ips: ['203.0.113.30'],
      },
      {
        bindingId: 5,
        serviceId: 20,
        serviceName: 'MSK Macloud',
        serviceSlug: 'msk-macloud',
        fqdn: 'mhome.rkns.top',
        zoneName: 'rkns.top',
        hostname: 'mhome',
        ips: [],
        cnameTarget: 'somewhere.else',
      },
    ])

    expect(result.matched).toBe(2)
    expect(result.unmatched).toBe(0)
    const domains = vpsDomainsRepository.listByVpsId(created.id)
    expect(domains.map((d) => d.fqdn).sort()).toEqual(['home.rkns.top', 'mhome.rkns.top'])
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
