import { describe, expect, it } from 'vitest'
import {
  applyMembershipHandles,
  clusterIdsForService,
  pickMembershipHandles,
} from './membership-handles'
import type { TopologyFlowNode } from './types'
import { membershipEdgeData } from './edge-utils'

describe('pickMembershipHandles', () => {
  const origin = { x: 0, y: 0 }

  it('picks bottom→top when VPS is below', () => {
    expect(pickMembershipHandles(origin, { x: 0, y: 100 })).toEqual({
      sourceHandle: 'bottom',
      targetHandle: 'top',
    })
  })

  it('picks top→bottom when VPS is above', () => {
    expect(pickMembershipHandles(origin, { x: 0, y: -100 })).toEqual({
      sourceHandle: 'top',
      targetHandle: 'bottom',
    })
  })

  it('picks right→left when VPS is to the right', () => {
    expect(pickMembershipHandles(origin, { x: 100, y: 0 })).toEqual({
      sourceHandle: 'right',
      targetHandle: 'left',
    })
  })

  it('picks left→right when VPS is to the left', () => {
    expect(pickMembershipHandles(origin, { x: -100, y: 0 })).toEqual({
      sourceHandle: 'left',
      targetHandle: 'right',
    })
  })

  it('uses vertical on below-right diagonal', () => {
    expect(pickMembershipHandles(origin, { x: 10, y: 20 })).toEqual({
      sourceHandle: 'bottom',
      targetHandle: 'top',
    })
  })

  it('uses vertical on below-left diagonal', () => {
    expect(pickMembershipHandles(origin, { x: -10, y: 20 })).toEqual({
      sourceHandle: 'bottom',
      targetHandle: 'top',
    })
  })

  it('uses vertical on above-right diagonal', () => {
    expect(pickMembershipHandles(origin, { x: 10, y: -20 })).toEqual({
      sourceHandle: 'top',
      targetHandle: 'bottom',
    })
  })

  it('uses vertical on above-left diagonal', () => {
    expect(pickMembershipHandles(origin, { x: -10, y: -20 })).toEqual({
      sourceHandle: 'top',
      targetHandle: 'bottom',
    })
  })

  it('uses vertical when axes are equal', () => {
    expect(pickMembershipHandles(origin, { x: 40, y: 40 })).toEqual({
      sourceHandle: 'bottom',
      targetHandle: 'top',
    })
  })
})

describe('clusterIdsForService', () => {
  it('includes the service and membership VPS only', () => {
    const ids = clusterIdsForService('svc-1', [
      { source: 'svc-1', target: 'vps-a', data: { relation: 'membership' } },
      { source: 'svc-1', target: 'vps-b', data: { relation: 'membership' } },
      { source: 'svc-2', target: 'vps-a', data: { relation: 'membership' } },
      { source: 'vps-a', target: 'vps-c', data: { relation: 'network' } },
    ])
    expect(ids.sort()).toEqual(['svc-1', 'vps-a', 'vps-b'])
  })
})

describe('applyMembershipHandles', () => {
  it('sets handles from node centers', () => {
    const nodes: TopologyFlowNode[] = [
      { id: 'svc', type: 'service', position: { x: 0, y: 0 }, data: { label: 'S', cfdmServiceId: 1, fqdn: '' } },
      { id: 'vps', type: 'vps', position: { x: 0, y: 200 }, data: { vpsId: 'v1' } },
    ]
    const edges = [
      {
        id: 'e1',
        source: 'svc',
        target: 'vps',
        data: membershipEdgeData(),
      },
    ]
    const next = applyMembershipHandles(edges, nodes)
    expect(next[0]?.sourceHandle).toBe('bottom')
    expect(next[0]?.targetHandle).toBe('top')
  })
})
