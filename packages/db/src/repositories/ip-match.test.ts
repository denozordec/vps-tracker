import { describe, expect, it } from 'vitest'
import {
  collectVpsIps,
  findVpsIdByIps,
  isPrivateOrLoopbackIp,
  normalizeIp,
} from './ip-match.js'

describe('ip-match', () => {
  it('собирает ipv4, ipv6 и additionalIps', () => {
    expect(
      collectVpsIps({
        ip: '203.0.113.10',
        ipv6: '2001:db8::1',
        additionalIps: ['198.51.100.2'],
      }),
    ).toEqual(['203.0.113.10', '2001:db8::1', '198.51.100.2'])
  })

  it('матчит ровно один VPS по IPv6', () => {
    const all = [
      { id: 'a', ip: '203.0.113.1', ipv6: '2001:db8::10', additionalIps: [] },
      { id: 'b', ip: '203.0.113.2', ipv6: '2001:db8::20', additionalIps: [] },
    ]
    expect(findVpsIdByIps(all, ['2001:DB8::10'])).toBe('a')
  })

  it('не матчит при двух совпадениях', () => {
    const all = [
      { id: 'a', ip: '203.0.113.10', additionalIps: [] },
      { id: 'b', ip: '', additionalIps: ['203.0.113.10'] },
    ]
    expect(findVpsIdByIps(all, ['203.0.113.10'])).toBeNull()
  })

  it('считает loopback и RFC1918 приватными', () => {
    expect(isPrivateOrLoopbackIp('127.0.0.1')).toBe(true)
    expect(isPrivateOrLoopbackIp('10.1.2.3')).toBe(true)
    expect(isPrivateOrLoopbackIp('192.168.0.1')).toBe(true)
    expect(isPrivateOrLoopbackIp('::1')).toBe(true)
    expect(isPrivateOrLoopbackIp('203.0.113.10')).toBe(false)
    expect(normalizeIp('  203.0.113.10  ')).toBe('203.0.113.10')
  })
})
