import { describe, expect, it } from 'vitest'

import { parseVeespBalanceResponse, parseVeespCollection } from './operations.js'
import type { VeespIpItem, VeespVmListItem } from './operations.js'

describe('parseVeespBalanceResponse', () => {
  it('uses acc_credit as available prepaid balance', () => {
    const result = parseVeespBalanceResponse({
      success: true,
      details: { currency: 'EUR', acc_balance: '0.00', acc_credit: '42.50' },
    })
    expect(result.balance).toBe(42.5)
    expect(result.currency).toBe('EUR')
  })

  it('does not treat unpaid invoice total (acc_balance) as account balance', () => {
    const result = parseVeespBalanceResponse({
      success: true,
      details: { currency: 'USD', acc_balance: '123456.55', acc_credit: '0.00' },
    })
    expect(result.balance).toBe(0)
  })

  it('falls back to credit field when acc_credit is absent', () => {
    const result = parseVeespBalanceResponse({
      details: { currency: 'RUB', credit: '15.25' },
    })
    expect(result.balance).toBe(15.25)
    expect(result.currency).toBe('RUB')
  })
})

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
