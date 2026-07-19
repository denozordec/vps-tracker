import { describe, expect, it, vi, afterEach } from 'vitest'

import { elemToObject, extractList, parseDatacenterName } from './parsers.js'
import { mapVdsToVps } from './mappers.js'
import {
  DEFAULT_PROFILE,
  mergeProfile,
  resolveBillmanagerProfile,
  waicoreOverrides,
} from './profiles/index.js'
import { fetchVds, mapVdsWithProfile } from './operations.js'
import {
  enrichMappedVpsFromTariffs,
  parseSpecsFromVdsEdit,
} from './vds-specs.js'

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

const FIRSTBYTE_VDS_FIXTURE = {
  func: 'vds',
  elem: [
    {
      id: '4478979',
      ip: '45.95.202.221',
      domain: 'auth.shnt.top',
      expiredate: '2026-10-15',
      real_expiredate: '2026-10-15',
      billdaily: 'off',
      datacentername: '1 Датацентр Россия, Москва',
      ostempl: 'Debian-13-amd64',
      pricelist: 'MSK-KVM-SSD-START',
      pricelist_id: '5228',
      currency_str: 'RUB',
      createdate: '2026-07-15',
      item_status_orig: '2',
      cost: '75.00 RUB / Месяц',
    },
    {
      id: '4208964',
      ip: '193.168.227.234',
      domain: 'vt.shnt.top',
      expiredate: 'Ежедневное списание',
      real_expiredate: '2026-07-20',
      billdaily: 'on',
      datacentername: '1 Датацентр Россия, Москва',
      ostempl: 'Debian-13-amd64',
      pricelist: 'MSK-KVM-SAS-1',
      pricelist_id: '564',
      currency_str: 'RUB',
      createdate: '2026-04-21',
      item_status_orig: '2',
      cost: '129.00 RUB / Месяц',
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

  it('resolve: firstbyte hostname → firstbyte profile', () => {
    const p = resolveBillmanagerProfile('https://my.firstbyte.ru/')
    expect(p.id).toBe('firstbyte')
    expect(p.funcs.listVds).toBe('vds')
    expect(p.map.enrichVds).toBeTypeOf('function')
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

  it('parseDatacenterName: FirstByte «1 Датацентр Россия, Москва»', () => {
    expect(parseDatacenterName('1 Датацентр Россия, Москва')).toEqual({
      country: 'Россия',
      location: 'Москва',
    })
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

  it('FirstByte: country/city + paidUntil for monthly and daily', () => {
    const profile = resolveBillmanagerProfile('https://bill.firstbyte.ru/')
    const elems = extractList(FIRSTBYTE_VDS_FIXTURE, profile.extract.listVdsKey)
    expect(elems).toHaveLength(2)

    const monthly = mapVdsWithProfile(
      profile,
      elemToObject(elems[0]!),
      'prov-fb',
      'acc-fb',
    )
    expect(monthly.country).toBe('Россия')
    expect(monthly.city).toBe('Москва')
    expect(monthly.datacenter).toBe('1 Датацентр Россия, Москва')
    expect(monthly.paidUntil).toBe('2026-10-15')
    expect(monthly.tariffType).toBe('monthly')
    expect(monthly.diskType).toBe('SSD')
    expect(monthly.virtualization).toBe('KVM')
    expect(monthly.vcpu).toBe(0)

    const daily = mapVdsWithProfile(
      profile,
      elemToObject(elems[1]!),
      'prov-fb',
      'acc-fb',
    )
    expect(daily.country).toBe('Россия')
    expect(daily.city).toBe('Москва')
    expect(daily.paidUntil).toBe('2026-07-20')
    expect(daily.tariffType).toBe('daily')
    expect(daily.diskType).toBe('SAS')
  })

  it('FirstByte: specs from vds.order by pricelist_id', () => {
    const profile = resolveBillmanagerProfile('https://my.firstbyte.ru/')
    expect(profile.options?.fetchVdsEditForSpecs).toBe(true)

    const item = elemToObject(FIRSTBYTE_VDS_FIXTURE.elem[0]!)
    let mapped = mapVdsWithProfile(profile, item, 'p', 'a')
    mapped = enrichMappedVpsFromTariffs(item, mapped, [
      {
        externalId: '5228',
        name: 'START',
        desc: 'START<br/>Процессор: 1 ядро; Память: 1 GB; Диск: 15 GB SSD',
        vcpu: 1,
        ramGb: 1,
        diskGb: 15,
        diskType: 'SSD',
        virtualization: 'KVM',
      },
    ])
    expect(mapped.vcpu).toBe(1)
    expect(mapped.ramGb).toBe(1)
    expect(mapped.diskGb).toBe(15)
  })

  it('parseSpecsFromVdsEdit reads addon labels', () => {
    const specs = parseSpecsFromVdsEdit({
      model: {
        addon_11: '2',
        addon_12: '2048',
        addon_13: '40',
        pricelist: 'MSK-KVM-SSD-START',
      },
      messages: [
        { name: 'addon_11', msg: 'Количество ядер процессора' },
        { name: 'addon_12', msg: 'Память (MB)' },
        { name: 'addon_13', msg: 'Диск SSD (GB)' },
      ],
    })
    expect(specs.vcpu).toBe(2)
    expect(specs.ramGb).toBe(2)
    expect(specs.diskGb).toBe(40)
    expect(specs.diskType).toBe('SSD')
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
