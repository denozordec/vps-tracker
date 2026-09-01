import { describe, expect, it } from 'vitest'
import { placeCfdmServiceGroup } from './place-cfdm-service'
import { isGroupNodeData, isVpsNodeData, type TopologyFlowNode } from './types'
import type { CfdmTopologyService } from './cfdm-services'

const service: CfdmTopologyService = {
  serviceId: 10,
  name: 'VPN',
  slug: 'vpn',
  lbMode: 'failover',
  fqdns: ['vpn.example.com'],
  matchedVpsIds: ['vps-a', 'vps-b'],
  unmatchedIps: [],
}

describe('placeCfdmServiceGroup', () => {
  it('creates a group with two VPS children', () => {
    const { nodes, alreadyOnCanvas } = placeCfdmServiceGroup([], service, { x: 0, y: 0 })
    expect(alreadyOnCanvas).toBe(false)
    const group = nodes.find((n) => n.type === 'group')
    expect(group).toBeTruthy()
    expect(isGroupNodeData(group!.data) && group!.data.lbMode).toBe('failover')
    expect(isGroupNodeData(group!.data) && group!.data.cfdmServiceId).toBe(10)
    const children = nodes.filter((n) => n.parentId === group!.id)
    expect(children).toHaveLength(2)
    const ids = children
      .filter((n): n is TopologyFlowNode & { data: { vpsId: string } } => isVpsNodeData(n.data))
      .map((n) => n.data.vpsId)
      .sort()
    expect(ids).toEqual(['vps-a', 'vps-b'])
  })

  it('does not duplicate a service already on the canvas', () => {
    const first = placeCfdmServiceGroup([], service, { x: 0, y: 0 }).nodes
    const second = placeCfdmServiceGroup(first, service, { x: 100, y: 100 })
    expect(second.alreadyOnCanvas).toBe(true)
    expect(second.nodes.filter((n) => n.type === 'group')).toHaveLength(1)
  })

  it('skips a VPS that already belongs to another CFDM group', () => {
    const other: CfdmTopologyService = {
      ...service,
      serviceId: 11,
      name: 'DNS',
      matchedVpsIds: ['vps-a'],
    }
    const withOther = placeCfdmServiceGroup([], other, { x: 0, y: 0 }).nodes
    const result = placeCfdmServiceGroup(withOther, service, { x: 0, y: 200 })
    expect(result.skippedVpsIds).toEqual(['vps-a'])
    const vpn = result.nodes.find(
      (n) => n.type === 'group' && isGroupNodeData(n.data) && n.data.cfdmServiceId === 10,
    )
    expect(vpn).toBeTruthy()
    const vpnChildren = result.nodes.filter((n) => n.parentId === vpn!.id)
    expect(vpnChildren).toHaveLength(1)
    expect(isVpsNodeData(vpnChildren[0]!.data) && vpnChildren[0]!.data.vpsId).toBe('vps-b')
  })
})
