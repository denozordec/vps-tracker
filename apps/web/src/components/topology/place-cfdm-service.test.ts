import { describe, expect, it } from 'vitest'
import { placeCfdmService, placeCfdmServices, migrateCfdmGroupsToServices } from './place-cfdm-service'
import { isServiceNodeData, isVpsNodeData, type TopologyFlowNode } from './types'
import type { CfdmTopologyService } from './cfdm-services'

const vpn: CfdmTopologyService = {
  serviceId: 10,
  name: 'VPN',
  slug: 'vpn',
  lbMode: 'failover',
  fqdns: ['vpn.example.com', 'vpn-alt.example.com'],
  matchedVpsIds: ['vps-a', 'vps-b'],
  unmatchedIps: [],
}

const dns: CfdmTopologyService = {
  serviceId: 11,
  name: 'DNS',
  slug: 'dns',
  lbMode: 'round_robin',
  fqdns: ['ns.shnt.top'],
  matchedVpsIds: ['vps-a', 'vps-b'],
  unmatchedIps: [],
}

const bgp: CfdmTopologyService = {
  serviceId: 12,
  name: 'BGP',
  slug: 'bgp',
  lbMode: 'failover',
  fqdns: ['bgp.example.com'],
  matchedVpsIds: ['vps-a', 'vps-c'],
  unmatchedIps: [],
}

function vpsIds(nodes: TopologyFlowNode[]): string[] {
  return nodes
    .filter((n): n is TopologyFlowNode & { data: { vpsId: string } } => isVpsNodeData(n.data))
    .map((n) => n.data.vpsId)
    .sort()
}

describe('placeCfdmService', () => {
  it('creates a service node, VPS cards without parentId, and membership edges', () => {
    const { nodes, edges, alreadyOnCanvas } = placeCfdmService([], [], vpn, { x: 0, y: 0 })
    expect(alreadyOnCanvas).toBe(false)
    const service = nodes.find((n) => n.type === 'service')
    expect(service).toBeTruthy()
    expect(isServiceNodeData(service!.data) && service!.data.lbMode).toBe('failover')
    expect(isServiceNodeData(service!.data) && service!.data.cfdmServiceId).toBe(10)
    expect(isServiceNodeData(service!.data) && service!.data.fqdn).toBe('vpn.example.com')
    expect(isServiceNodeData(service!.data) && service!.data.extraFqdns).toEqual([
      'vpn-alt.example.com',
    ])
    expect(nodes.some((n) => n.parentId)).toBe(false)
    expect(vpsIds(nodes)).toEqual(['vps-a', 'vps-b'])
    expect(edges.every((e) => e.data?.relation === 'membership')).toBe(true)
    expect(edges).toHaveLength(2)
    expect(edges.every((e) => e.source === service!.id)).toBe(true)
  })

  it('does not duplicate a service already on the canvas', () => {
    const first = placeCfdmService([], [], vpn, { x: 0, y: 0 })
    const second = placeCfdmService(first.nodes, first.edges, vpn, { x: 100, y: 100 })
    expect(second.alreadyOnCanvas).toBe(true)
    expect(second.nodes.filter((n) => n.type === 'service')).toHaveLength(1)
  })

  it('lets one VPS belong to DNS and BGP without cloning the card', () => {
    const first = placeCfdmService([], [], dns, { x: 0, y: 0 })
    const result = placeCfdmService(first.nodes, first.edges, bgp, { x: 0, y: 200 })
    expect(result.alreadyOnCanvas).toBe(false)
    expect(result.nodes.filter((n) => n.type === 'service')).toHaveLength(2)
    expect(vpsIds(result.nodes)).toEqual(['vps-a', 'vps-b', 'vps-c'])
    const aNode = result.nodes.find(
      (n) => n.type === 'vps' && isVpsNodeData(n.data) && n.data.vpsId === 'vps-a',
    )
    expect(aNode).toBeTruthy()
    const membershipToA = result.edges.filter(
      (e) => e.data?.relation === 'membership' && e.target === aNode!.id,
    )
    expect(membershipToA).toHaveLength(2)
  })
})

describe('placeCfdmServices', () => {
  it('places several services and reports already-on-canvas ids', () => {
    const first = placeCfdmServices([], [], [dns], { x: 0, y: 0 })
    const second = placeCfdmServices(first.nodes, first.edges, [dns, bgp], { x: 0, y: 0 })
    expect(second.alreadyIds).toEqual([11])
    expect(second.nodes.filter((n) => n.type === 'service')).toHaveLength(2)
  })
})

describe('migrateCfdmGroupsToServices', () => {
  it('converts a CFDM group with parentId children into a service node and membership edges', () => {
    const group: TopologyFlowNode = {
      id: 'group-1',
      type: 'group',
      position: { x: 10, y: 20 },
      style: { width: 400, height: 200 },
      data: { label: 'DNS', cfdmServiceId: 11, lbMode: 'round_robin' },
    }
    const childA: TopologyFlowNode = {
      id: 'vps-node-a',
      type: 'vps',
      parentId: 'group-1',
      position: { x: 20, y: 40 },
      data: { vpsId: 'vps-a' },
    }
    const childB: TopologyFlowNode = {
      id: 'vps-node-b',
      type: 'vps',
      parentId: 'group-1',
      position: { x: 240, y: 40 },
      data: { vpsId: 'vps-b' },
    }
    const { nodes, edges, changed } = migrateCfdmGroupsToServices(
      [group, childA, childB],
      [],
      [dns],
    )
    expect(changed).toBe(true)
    const service = nodes.find((n) => n.id === 'group-1')
    expect(service?.type).toBe('service')
    expect(isServiceNodeData(service!.data) && service!.data.fqdn).toBe('ns.shnt.top')
    expect(nodes.every((n) => !n.parentId)).toBe(true)
    expect(edges).toHaveLength(2)
    expect(edges.every((e) => e.data?.relation === 'membership' && e.source === 'group-1')).toBe(
      true,
    )
  })

  it('is a no-op when there are no CFDM groups', () => {
    const placed = placeCfdmService([], [], dns, { x: 0, y: 0 })
    const again = migrateCfdmGroupsToServices(placed.nodes, placed.edges, [dns])
    expect(again.changed).toBe(false)
    expect(again.nodes.filter((n) => n.type === 'group')).toHaveLength(0)
  })

  it('strips leftover group size from an already converted service node', () => {
    const placed = placeCfdmService([], [], dns, { x: 0, y: 0 })
    const wide = placed.nodes.map((n) =>
      n.type === 'service' ? { ...n, width: 400, height: 200, style: { width: 400, height: 200 } } : n,
    )
    const { nodes, changed } = migrateCfdmGroupsToServices(wide, placed.edges, [dns])
    expect(changed).toBe(true)
    const service = nodes.find((n) => n.type === 'service')
    expect(service?.width).toBeUndefined()
    expect(service?.style).toBeUndefined()
  })
})
