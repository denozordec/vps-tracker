import { describe, expect, it } from 'vitest'

import { parseVeespCollection } from './operations.js'
import type { VeespIpItem, VeespVmListItem } from './operations.js'

describe('parseVeespCollection', () => {
  it('parses vms object-map from Veesp API', () => {
    const json = {
      vms: {
        '17228': {
          label: 'rkn0',
          hostname: 'rkn0',
          cpus: '2',
          memory: 2048,
          disk: 40,
          ip: ['198.51.100.5'],
          template_label: 'Debian 12',
          status: 'active',
        },
      },
    }
    const vms = parseVeespCollection<VeespVmListItem>(json, 'vms')
    expect(vms).toHaveLength(1)
    expect(vms[0]?.id).toBe('17228')
    expect(vms[0]?.label).toBe('rkn0')
    expect(vms[0]?.cpus).toBe('2')
    expect(vms[0]?.ip).toEqual(['198.51.100.5'])
  })

  it('parses ips as string array', () => {
    const json = { ips: ['198.51.100.5', '2001:db8::1'] }
    const ips = parseVeespCollection<VeespIpItem>(json, 'ips')
    expect(ips).toEqual([{ ip: '198.51.100.5' }, { ip: '2001:db8::1' }])
  })

  it('parses ips object-map', () => {
    const json = {
      ips: {
        '1': { ipaddress: '198.51.100.5', main: '1' },
        '2': { ipaddress: '10.0.0.2' },
      },
    }
    const ips = parseVeespCollection<VeespIpItem>(json, 'ips')
    expect(ips).toHaveLength(2)
    expect(ips[0]?.ipaddress).toBe('198.51.100.5')
    expect(ips[0]?.id).toBe('1')
  })
})
