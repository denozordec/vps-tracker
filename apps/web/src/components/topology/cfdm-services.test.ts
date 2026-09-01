import { describe, expect, it } from 'vitest'
import type { VpsDomain } from '@/types/entities'
import { aggregateCfdmServices } from './cfdm-services'

function domain(partial: Partial<VpsDomain> & Pick<VpsDomain, 'id' | 'cfdmServiceId'>): VpsDomain {
  return {
    vpsId: null,
    fqdn: 'vpn.example.com',
    zoneName: 'example.com',
    hostname: 'vpn',
    serviceName: 'VPN',
    serviceSlug: 'vpn',
    cfdmBindingId: 1,
    source: 'cfdm',
    matchStatus: 'unmatched',
    syncedAt: '2026-01-01T00:00:00.000Z',
    ...partial,
  }
}

describe('aggregateCfdmServices', () => {
  it('groups bindings by service and collects matched VPS', () => {
    const rows: VpsDomain[] = [
      domain({
        id: 'a',
        cfdmServiceId: 10,
        cfdmBindingId: 1,
        fqdn: 'vpn-a.example.com',
        vpsId: 'vps-1',
        matchStatus: 'matched',
        lbMode: 'failover',
      }),
      domain({
        id: 'b',
        cfdmServiceId: 10,
        cfdmBindingId: 2,
        fqdn: 'vpn-b.example.com',
        vpsId: 'vps-2',
        matchStatus: 'matched',
        lbMode: 'failover',
      }),
      domain({
        id: 'c',
        cfdmServiceId: 11,
        cfdmBindingId: 3,
        serviceName: 'DNS',
        serviceSlug: 'dns',
        fqdn: 'ns.example.com',
        matchStatus: 'unmatched',
        targetIps: JSON.stringify(['198.51.100.1']),
        lbMode: 'round_robin',
      }),
    ]

    const services = aggregateCfdmServices(rows)
    expect(services).toHaveLength(2)

    const vpn = services.find((s) => s.serviceId === 10)
    expect(vpn?.name).toBe('VPN')
    expect(vpn?.lbMode).toBe('failover')
    expect(vpn?.matchedVpsIds.sort()).toEqual(['vps-1', 'vps-2'])
    expect(vpn?.fqdns).toEqual(['vpn-a.example.com', 'vpn-b.example.com'])
    expect(vpn?.unmatchedIps).toEqual([])

    const dns = services.find((s) => s.serviceId === 11)
    expect(dns?.matchedVpsIds).toEqual([])
    expect(dns?.unmatchedIps).toEqual(['198.51.100.1'])
    expect(dns?.lbMode).toBe('round_robin')
  })

  it('deduplicates the same vpsId across bindings of one service', () => {
    const rows: VpsDomain[] = [
      domain({
        id: 'a',
        cfdmServiceId: 10,
        cfdmBindingId: 1,
        vpsId: 'vps-1',
        matchStatus: 'matched',
      }),
      domain({
        id: 'b',
        cfdmServiceId: 10,
        cfdmBindingId: 2,
        fqdn: 'vpn-b.example.com',
        vpsId: 'vps-1',
        matchStatus: 'matched',
      }),
    ]
    const [svc] = aggregateCfdmServices(rows)
    expect(svc?.matchedVpsIds).toEqual(['vps-1'])
  })
})
