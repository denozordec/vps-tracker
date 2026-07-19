import { describe, expect, it, vi, afterEach } from 'vitest'

import { elemToObject, extractList } from './parsers.js'
import { mapVdsToVps } from './mappers.js'
import {
  DEFAULT_PROFILE,
  mergeProfile,
  resolveBillmanagerProfile,
  waicoreOverrides,
} from './profiles/index.js'
import { fetchVds, mapVdsWithProfile } from './operations.js'

/** Minimal Waicore-style bjson (no credentials / addon noise). */
const WAICORE_VDS_FIXTURE = {
  func: 'vds.vps',
  elem: [
    {
      id: '87173',
      ip: '212.192.246.214',
      domain: 'instance87173.waicore.network',
      expiredate: '2027-01-21',
      real_expiredate: '2027-01-21',
      ostempl: 'Ubuntu 24.04',
      datacentername: '[DE] Франкфурт | Промо',
      pricelist: '[DE] RP-1',
      cost: '1.80 € / Месяц',
      item_cost: '10.8000',
      currency_str: '€',
      createdate: '2025-07-15',
      item_status_orig: '2',
      item_status: 'Активен',
    },
  ],
}

describe('billmanager profiles', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('resolve: waicore hostname → waicore profile', () => {
    const p = resolveBillmanagerProfile('https://my.waicore.com/')
    expect(p.id).toBe('waicore')
    expect(p.funcs.listVds).toBe('vds.vps')
    expect(p.funcs.payments).toBe('payment')
    expect(p.funcs.dashboard).toBe('dashboard.info')
  })

  it('resolve: keyword in URL → waicore', () => {
    expect(resolveBillmanagerProfile('https://panel.example/waicore-proxy').id).toBe(
      'waicore',
    )
  })

  it('resolve: unknown hoster → default', () => {
    const p = resolveBillmanagerProfile('https://bill.hoster.ru/')
    expect(p.id).toBe('default')
    expect(p.funcs.listVds).toBe('vds')
  })

  it('merge: only overrides listVds func', () => {
    const merged = mergeProfile(DEFAULT_PROFILE, waicoreOverrides)
    expect(merged.funcs.listVds).toBe('vds.vps')
    expect(merged.funcs.payments).toBe(DEFAULT_PROFILE.funcs.payments)
    expect(merged.extract.listVdsKey).toBe(DEFAULT_PROFILE.extract.listVdsKey)
    expect(merged.map.vds).toBe(DEFAULT_PROFILE.map.vds)
  })

  it('Waicore fixture elem → MappedVps fields', () => {
    const profile = resolveBillmanagerProfile('https://my.waicore.com/')
    const elems = extractList(WAICORE_VDS_FIXTURE, profile.extract.listVdsKey)
    expect(elems).toHaveLength(1)
    const item = elemToObject(elems[0]!)
    const vps = mapVdsWithProfile(profile, item, 'prov-1', 'acc-1')
    expect(vps.externalId).toBe('87173')
    expect(vps.ip).toBe('212.192.246.214')
    expect(vps.dns).toBe('instance87173.waicore.network')
    expect(vps.paidUntil).toBe('2027-01-21')
    expect(vps.os).toBe('Ubuntu 24.04')
    expect(vps.status).toBe('active')
  })

  it('fetchVds for waicore URL uses func=vds.vps', async () => {
    const calls: string[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input)
        calls.push(url)
        return {
          ok: true,
          json: async () => WAICORE_VDS_FIXTURE,
        }
      }),
    )

    const items = await fetchVds('https://my.waicore.com/', 'user:pass')
    expect(calls).toHaveLength(1)
    expect(calls[0]).toContain('func=vds.vps')
    expect(items).toHaveLength(1)
    expect(items[0]?.id).toBe('87173')
  })

  it('fetchVds for default URL uses func=vds', async () => {
    const calls: string[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input)
        calls.push(url)
        return {
          ok: true,
          json: async () => ({ elem: [] }),
        }
      }),
    )

    await fetchVds('https://bill.example.com/', 'user:pass')
    expect(calls[0]).toContain('func=vds')
    expect(calls[0]).not.toContain('func=vds.vps')
  })

  it('default mapVds still works without profile enrich', () => {
    const mapped = mapVdsToVps(
      {
        id: '1',
        ip: '1.2.3.4',
        domain: '',
        expiredate: '2026-12-01',
        item_status_orig: '2',
      },
      'p',
      'a',
    )
    expect(mapped.paidUntil).toBe('2026-12-01')
  })
})
