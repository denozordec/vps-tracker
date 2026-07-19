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
import {
  applyFirstbyteSharedDailyPaidUntil,
  monthlyToDailyRate,
} from './profiles/firstbyte.js'

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
    {
      id: '50642',
      ip: '193.233.134.103',
      domain: 'denode.ivx.su',
      expiredate: '2027-05-01',
      real_expiredate: '2027-05-01',
      ostempl: 'Ubuntu 24.04',
      datacentername: 'Германия, Франкфурт-на-Майне',
      pricelist: '[DE] RX-VPN',
      cost: '0.80 € / Месяц',
      item_cost: '9.6000',
      currency_str: '€',
      createdate: '2025-04-25',
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

/** Minimal ihor-style bjson (`datacentername`: «Москва DC3»). */
const IHOR_VDS_FIXTURE = {
  func: 'vds',
  elem: [
    {
      id: '2927366',
      ip: '185.105.116.43',
      domain: 'vds2927366.my-ihor.ru',
      expiredate: '2026-08-08',
      real_expiredate: '2026-08-08',
      datacenter: '1',
      datacentername: 'Москва DC3',
      ostempl: 'Ubuntu-26.04-amd64',
      pricelist: 'KVM SSD Start (1 СPU/768 MB RAM/7 GB SSD)',
      pricelist_id: '7818',
      intname: 'SSD_Start',
      cost: '100.00 RUB / Месяц',
      item_cost: '100.0000',
      currency_str: 'RUB',
      createdate: '2026-03-08',
      item_status_orig: '2',
      item_status: 'Активен',
    },
  ],
}

/** Minimal Cloudrix-style bjson — promo plan without CPU/RAM in pricelist name. */
const CLOUDRIX_VDS_FIXTURE = {
  func: 'vds',
  elem: [
    {
      id: '8226',
      ip: '95.85.240.37',
      domain: 'msk.shz.su',
      expiredate: '2026-08-18',
      real_expiredate: '2026-08-18',
      datacenter: '1',
      datacentername: 'Россия, Москва',
      ipv6_subnet: '2a12:bec4:1280:7e::/64',
      ostempl: 'Alma Linux 10',
      pricelist: 'SPROMO-1',
      pricelist_id: '1',
      intname: 'spromo',
      cost: '160.00 RUB / Месяц',
      item_cost: '160.0000',
      currency_str: 'RUB',
      createdate: '2026-05-18',
      item_status_orig: '2',
      item_status: 'Активен',
    },
  ],
}

/** Minimal serv.host bjson — named Xeon plan, city+CPU line in datacentername. */
const SERVHOST_VDS_FIXTURE = {
  func: 'vds',
  elem: [
    {
      id: '621601',
      ip: '178.250.186.111',
      domain: 'shatskiy.denis.serv.host',
      expiredate: '2027-06-16',
      real_expiredate: '2027-06-16',
      datacenter: '5',
      datacentername: 'Новосибирск Xeon',
      ostempl: 'Ubuntu 24.04',
      pricelist: 'Тариф «Xeon 2667V2-1»',
      pricelist_id: '502',
      intname: 'Тариф «Xeon 2667V2-1»',
      cost: '127.50 RUB / Месяц',
      item_cost: '1530.0000',
      currency_str: 'RUB',
      createdate: '2026-02-16',
      item_status_orig: '2',
      item_status: 'Активен',
    },
  ],
}

/** Minimal LandVPS bjson — `ДЦ Москва`, tariff code MSK-0, ipv6_subnet. */
const LANDVPS_VDS_FIXTURE = {
  func: 'vds',
  elem: [
    {
      id: '196380',
      ip: '77.105.133.124',
      domain: '196380.landvps.online',
      expiredate: '2026-08-21',
      real_expiredate: '2026-08-21',
      datacenter: '3',
      datacentername: 'ДЦ Москва',
      ipv6_subnet: '2a12:b3c0:1:b6::/64',
      ostempl: 'Ubuntu 24.04',
      pricelist: 'MSK-0',
      pricelist_id: '19',
      intname: 'RUS-0',
      cost: '90.00 RUB / Месяц',
      item_cost: '270.0000',
      currency_str: 'RUB',
      createdate: '2026-04-21',
      item_status_orig: '2',
      item_status: 'Активен',
    },
  ],
}

/** Minimal Datacheap bjson — country-only DC, NVMe plan without CPU/RAM in name. */
const DATACHEAP_VDS_FIXTURE = {
  func: 'vds',
  elem: [
    {
      id: '189678',
      ip: '84.252.100.102',
      domain: 'dc.msk.rt.shx.su',
      expiredate: '2026-08-21',
      real_expiredate: '2026-08-21',
      datacenter: '8',
      datacentername: 'Россия',
      ostempl: 'Ubuntu 24.04',
      pricelist: 'VPS Start NVMe unlimited (RU)',
      pricelist_id: '2489',
      intname: 'NVMe unlim',
      cost: '203.70 RUB / Месяц',
      item_cost: '611.1000',
      currency_str: 'RUB',
      createdate: '2026-01-21',
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

  it('resolve: firstbyte hostname → firstbyte profile', () => {
    const p = resolveBillmanagerProfile('https://my.firstbyte.ru/')
    expect(p.id).toBe('firstbyte')
    expect(p.funcs.listVds).toBe('vds')
    expect(p.map.enrichVds).toBeTypeOf('function')
  })

  it('resolve: ihor hostname → ihor profile', () => {
    const p = resolveBillmanagerProfile('https://bill.my-ihor.ru/')
    expect(p.id).toBe('ihor')
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

  it('parseDatacenterName: ihor «Москва DC3»', () => {
    expect(parseDatacenterName('Москва DC3')).toEqual({
      country: 'Россия',
      location: 'Москва',
    })
  })

  it('ihor fixture → country/city from datacentername', () => {
    const profile = resolveBillmanagerProfile('https://my-ihor.ru/')
    const elems = extractList(IHOR_VDS_FIXTURE, profile.extract.listVdsKey)
    expect(elems).toHaveLength(1)
    const vps = mapVdsWithProfile(
      profile,
      elemToObject(elems[0]!),
      'prov-ihor',
      'acc-ihor',
    )
    expect(vps.externalId).toBe('2927366')
    expect(vps.ip).toBe('185.105.116.43')
    expect(vps.country).toBe('Россия')
    expect(vps.city).toBe('Москва')
    expect(vps.datacenter).toBe('Москва DC3')
    expect(vps.os).toBe('Ubuntu-26.04-amd64')
    expect(vps.paidUntil).toBe('2026-08-08')
    expect(vps.status).toBe('active')
  })

  it('resolve: cloudrix hostname → cloudrix profile', () => {
    const p = resolveBillmanagerProfile('https://bill.cloudrix.ru/')
    expect(p.id).toBe('cloudrix')
    expect(p.funcs.listVds).toBe('vds')
    expect(p.map.enrichVds).toBeTypeOf('function')
    expect(p.options?.fetchVdsEditForSpecs).toBe(true)
  })

  it('Cloudrix fixture → geo, ipv6; specs from vds.order by pricelist_id', () => {
    const profile = resolveBillmanagerProfile('https://cloudrix.ru/')
    const elems = extractList(CLOUDRIX_VDS_FIXTURE, profile.extract.listVdsKey)
    expect(elems).toHaveLength(1)
    const item = elemToObject(elems[0]!)
    let vps = mapVdsWithProfile(profile, item, 'prov-cr', 'acc-cr')
    expect(vps.externalId).toBe('8226')
    expect(vps.country).toBe('Россия')
    expect(vps.city).toBe('Москва')
    expect(vps.datacenter).toBe('Россия, Москва')
    expect(vps.ipv6).toBe('2a12:bec4:1280:7e::/64')
    expect(vps.os).toBe('Alma Linux 10')
    expect(vps.vcpu).toBe(0)
    expect(vps.ramGb).toBe(0)
    expect(vps.diskGb).toBe(0)

    vps = enrichMappedVpsFromTariffs(item, vps, [
      {
        externalId: '1',
        name: 'SPROMO-1',
        desc: '1 CPU / 1 GB RAM / 15 GB NVMe',
        vcpu: 1,
        ramGb: 1,
        diskGb: 15,
        diskType: 'NVMe',
        virtualization: 'KVM',
      },
    ])
    expect(vps.vcpu).toBe(1)
    expect(vps.ramGb).toBe(1)
    expect(vps.diskGb).toBe(15)
    expect(vps.diskType).toBe('NVMe')
    expect(vps.virtualization).toBe('KVM')
  })

  it('resolve: serv.host → servhost profile', () => {
    const p = resolveBillmanagerProfile('https://bill.serv.host/')
    expect(p.id).toBe('servhost')
    expect(p.funcs.listVds).toBe('vds')
    expect(p.options?.fetchVdsEditForSpecs).toBe(true)
  })

  it('parseDatacenterName: serv.host «Новосибирск Xeon»', () => {
    expect(parseDatacenterName('Новосибирск Xeon')).toEqual({
      country: 'Россия',
      location: 'Новосибирск',
    })
  })

  it('serv.host fixture → geo; specs from vds.order by pricelist_id', () => {
    const profile = resolveBillmanagerProfile('https://my.serv.host/')
    const elems = extractList(SERVHOST_VDS_FIXTURE, profile.extract.listVdsKey)
    expect(elems).toHaveLength(1)
    const item = elemToObject(elems[0]!)
    let vps = mapVdsWithProfile(profile, item, 'prov-sh', 'acc-sh')
    expect(vps.externalId).toBe('621601')
    expect(vps.country).toBe('Россия')
    expect(vps.city).toBe('Новосибирск')
    expect(vps.datacenter).toBe('Новосибирск Xeon')
    expect(vps.os).toBe('Ubuntu 24.04')
    expect(vps.vcpu).toBe(0)
    expect(vps.diskGb).toBe(0)

    vps = enrichMappedVpsFromTariffs(item, vps, [
      {
        externalId: '502',
        name: 'Тариф «Xeon 2667V2-1»',
        desc: '2 CPU / 2 GB RAM / 40 GB NVMe',
        vcpu: 2,
        ramGb: 2,
        diskGb: 40,
        diskType: 'NVMe',
        virtualization: 'KVM',
      },
    ])
    expect(vps.vcpu).toBe(2)
    expect(vps.ramGb).toBe(2)
    expect(vps.diskGb).toBe(40)
    expect(vps.virtualization).toBe('KVM')
  })

  it('resolve: landvps.online → landvps profile', () => {
    const p = resolveBillmanagerProfile('https://bill.landvps.online/')
    expect(p.id).toBe('landvps')
    expect(p.funcs.listVds).toBe('vds')
    expect(p.options?.fetchVdsEditForSpecs).toBe(true)
  })

  it('parseDatacenterName: LandVPS «ДЦ Москва»', () => {
    expect(parseDatacenterName('ДЦ Москва')).toEqual({
      country: 'Россия',
      location: 'Москва',
    })
  })

  it('LandVPS fixture → geo, ipv6; specs from vds.order by pricelist_id', () => {
    const profile = resolveBillmanagerProfile('https://my.landvps.online/')
    const elems = extractList(LANDVPS_VDS_FIXTURE, profile.extract.listVdsKey)
    expect(elems).toHaveLength(1)
    const item = elemToObject(elems[0]!)
    let vps = mapVdsWithProfile(profile, item, 'prov-lv', 'acc-lv')
    expect(vps.externalId).toBe('196380')
    expect(vps.country).toBe('Россия')
    expect(vps.city).toBe('Москва')
    expect(vps.datacenter).toBe('ДЦ Москва')
    expect(vps.ipv6).toBe('2a12:b3c0:1:b6::/64')
    expect(vps.os).toBe('Ubuntu 24.04')
    expect(vps.paidUntil).toBe('2026-08-21')
    expect(vps.vcpu).toBe(0)
    expect(vps.diskGb).toBe(0)

    vps = enrichMappedVpsFromTariffs(item, vps, [
      {
        externalId: '19',
        name: 'MSK-0',
        desc: '1 CPU / 1 GB RAM / 20 GB NVMe',
        vcpu: 1,
        ramGb: 1,
        diskGb: 20,
        diskType: 'NVMe',
        virtualization: 'KVM',
      },
    ])
    expect(vps.vcpu).toBe(1)
    expect(vps.ramGb).toBe(1)
    expect(vps.diskGb).toBe(20)
    expect(vps.virtualization).toBe('KVM')
  })

  it('resolve: datacheap.ru → datacheap profile', () => {
    const p = resolveBillmanagerProfile('https://bill.datacheap.ru/')
    expect(p.id).toBe('datacheap')
    expect(p.funcs.listVds).toBe('vds')
    expect(p.options?.fetchVdsEditForSpecs).toBe(true)
  })

  it('parseDatacenterName: Datacheap «Россия»', () => {
    expect(parseDatacenterName('Россия')).toEqual({
      country: 'Россия',
      location: '',
    })
  })

  it('Datacheap fixture → country; specs from vds.order by pricelist_id', () => {
    const profile = resolveBillmanagerProfile('https://my.datacheap.ru/')
    const elems = extractList(DATACHEAP_VDS_FIXTURE, profile.extract.listVdsKey)
    expect(elems).toHaveLength(1)
    const item = elemToObject(elems[0]!)
    let vps = mapVdsWithProfile(profile, item, 'prov-dc', 'acc-dc')
    expect(vps.externalId).toBe('189678')
    expect(vps.country).toBe('Россия')
    expect(vps.city).toBe('')
    expect(vps.datacenter).toBe('Россия')
    expect(vps.os).toBe('Ubuntu 24.04')
    expect(vps.paidUntil).toBe('2026-08-21')
    expect(vps.vcpu).toBe(0)
    expect(vps.diskGb).toBe(0)

    vps = enrichMappedVpsFromTariffs(item, vps, [
      {
        externalId: '2489',
        name: 'VPS Start NVMe unlimited (RU)',
        desc: '1 CPU / 1 GB RAM / 15 GB NVMe',
        vcpu: 1,
        ramGb: 1,
        diskGb: 15,
        diskType: 'NVMe',
        virtualization: 'KVM',
      },
    ])
    expect(vps.vcpu).toBe(1)
    expect(vps.ramGb).toBe(1)
    expect(vps.diskGb).toBe(15)
    expect(vps.diskType).toBe('NVMe')
    expect(vps.virtualization).toBe('KVM')
  })

  it('Waicore fixture elem → MappedVps fields + geo from datacentername', () => {
    const profile = resolveBillmanagerProfile('https://my.waicore.com/')
    const elems = extractList(WAICORE_VDS_FIXTURE, profile.extract.listVdsKey)
    expect(elems).toHaveLength(2)

    const promo = mapVdsWithProfile(
      profile,
      elemToObject(elems[0]!),
      'prov-1',
      'acc-1',
    )
    expect(promo.externalId).toBe('87173')
    expect(promo.ip).toBe('212.192.246.214')
    expect(promo.dns).toBe('instance87173.waicore.network')
    expect(promo.paidUntil).toBe('2027-01-21')
    expect(promo.os).toBe('Ubuntu 24.04')
    expect(promo.status).toBe('active')
    expect(promo.country).toBe('Германия')
    expect(promo.city).toBe('Франкфурт')
    expect(promo.datacenter).toBe('[DE] Франкфурт | Промо')

    const fullName = mapVdsWithProfile(
      profile,
      elemToObject(elems[1]!),
      'prov-1',
      'acc-1',
    )
    expect(fullName.externalId).toBe('50642')
    expect(fullName.country).toBe('Германия')
    expect(fullName.city).toBe('Франкфурт-на-Майне')
    expect(fullName.datacenter).toBe('Германия, Франкфурт-на-Майне')
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
    expect(monthly.dailyRate).toBeNull()

    const daily = mapVdsWithProfile(
      profile,
      elemToObject(elems[1]!),
      'prov-fb',
      'acc-fb',
    )
    expect(daily.country).toBe('Россия')
    expect(daily.city).toBe('Москва')
    expect(daily.paidUntil).toBe('')
    expect(daily.tariffType).toBe('daily')
    expect(daily.diskType).toBe('SAS')
    expect(daily.monthlyRate).toBe(129)
    expect(daily.dailyRate).toBe(monthlyToDailyRate(129))
  })

  it('FirstByte: shared balance → same paidUntil for all daily VPS', () => {
    const profile = resolveBillmanagerProfile('https://my.firstbyte.ru/')
    expect(profile.map.enrichVdsBatch).toBeTypeOf('function')

    const a = mapVdsWithProfile(
      profile,
      elemToObject({
        id: '1',
        billdaily: 'on',
        expiredate: 'Ежедневное списание',
        cost: '129.00 RUB / Месяц',
        currency_str: 'RUB',
        item_status_orig: '2',
        ip: '1.1.1.1',
        datacentername: '1 Датацентр Россия, Москва',
      }),
      'p',
      'a',
    )
    const b = mapVdsWithProfile(
      profile,
      elemToObject({
        id: '2',
        billdaily: 'on',
        expiredate: 'Ежедневное списание',
        cost: '129.00 RUB / Месяц',
        currency_str: 'RUB',
        item_status_orig: '2',
        ip: '2.2.2.2',
        datacentername: '1 Датацентр Россия, Москва',
      }),
      'p',
      'a',
    )
    const monthly = mapVdsWithProfile(
      profile,
      elemToObject(FIRSTBYTE_VDS_FIXTURE.elem[0]!),
      'p',
      'a',
    )

    // 2 × (129/30) = 8.6/day; balance 86 → 10 days
    const asOf = new Date(Date.UTC(2026, 6, 19))
    const out = applyFirstbyteSharedDailyPaidUntil([a, b, monthly], 86, asOf)
    expect(out[0]!.paidUntil).toBe('2026-07-29')
    expect(out[1]!.paidUntil).toBe('2026-07-29')
    expect(out[2]!.paidUntil).toBe(monthly.paidUntil)
    expect(out[0]!.dailyRate).toBe(monthlyToDailyRate(129))
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
    expect(items).toHaveLength(2)
    expect(items[0]?.id).toBe('87173')
    expect(items[1]?.id).toBe('50642')
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
