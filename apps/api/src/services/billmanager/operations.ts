/**
 * BILLmanager API operations — fetch VDS, payments, dashboard, tariffs
 */

import { billmanagerRequest } from './client.js'
import {
  elemToObject,
  extractList,
  extractTariflist,
  parseDatacenterName,
  parseTariffDesc,
} from './parsers.js'

export interface DashboardInfo {
  balance: number
  currency: string
  enoughmoneyto: string
  realbalance: string
}

export interface TariffItem {
  externalId: string
  name: string
  desc: string
  vcpu: number
  ramGb: number
  diskGb: number
  diskType: string
  virtualization: string
  channel: string
  location: string
  cpuModel: string
  orderAvailable: boolean
  price: string
  datacenterKey?: string
  datacenterName?: string
  country?: string
}

export async function fetchVds(baseUrl: string, authinfo: string): Promise<Record<string, string>[]> {
  const data = await billmanagerRequest(baseUrl, authinfo, 'vds')
  const elems = extractList(data, 'vds')
  return elems.map((e) => elemToObject(e))
}

export async function fetchDashboardInfo(
  baseUrl: string,
  authinfo: string,
  opts: { fallbackCurrency?: string | null } = {},
): Promise<DashboardInfo> {
  const data = await billmanagerRequest(baseUrl, authinfo, 'dashboard.info', {
    dashboard: 'info',
    sfrom: 'ajax',
  })
  const elems =
    extractList(data, 'dashboard') ||
    (Array.isArray(data.elem) ? (data.elem as unknown[]) : [])
  const item = elems.length > 0 ? elemToObject(elems[0] as never) : {}
  const balanceStr = String(item.realbalance || item.balance || item.available || '0')
  const amount = parseFloat(balanceStr.replace(/[^\d.,-]/g, '').replace(',', '.')) || 0
  let currency = (balanceStr.match(/([A-Z]{3})\b/) || [])[1]
  if (!currency) {
    if (balanceStr.includes('€') || balanceStr.includes('EUR')) currency = 'EUR'
    else if (balanceStr.includes('$') || balanceStr.includes('USD')) currency = 'USD'
    else if (balanceStr.includes('₽') || balanceStr.includes('RUB')) currency = 'RUB'
    else if (balanceStr.includes('£')) currency = 'GBP'
    else currency = opts.fallbackCurrency || 'RUB'
  }
  return {
    balance: amount,
    currency: currency || opts.fallbackCurrency || 'RUB',
    enoughmoneyto: item.enoughmoneyto || '',
    realbalance: item.realbalance || '',
  }
}

export async function fetchPayments(
  baseUrl: string,
  authinfo: string,
  opts: {
    createdatestart?: string
    createdateend?: string
    createdate?: string
    filter?: string
    status?: string | number
  } = {},
): Promise<Record<string, string>[]> {
  const params: Record<string, string> = {}
  if (opts.createdatestart) params.createdatestart = opts.createdatestart
  if (opts.createdateend) params.createdateend = opts.createdateend
  if (opts.createdate === 'other') params.createdate = 'other'
  if (opts.filter === 'on') params.filter = 'on'
  if (opts.status != null) params.status = String(opts.status)
  const data = await billmanagerRequest(baseUrl, authinfo, 'payment', params)
  const elems = extractList(data, 'payment')
  return elems.map((e) => elemToObject(e))
}

export async function fetchVdsOrderPricelist(
  baseUrl: string,
  authinfo: string,
  opts: { plid?: string; period?: string; datacenter?: string } = {},
): Promise<{ tariffItems: TariffItem[]; slist: Record<string, unknown> }> {
  const params: Record<string, string> = {
    plid: opts.plid || '',
    sfrom: 'ajax',
  }
  if (opts.period) params.period = opts.period
  if (opts.datacenter) params.datacenter = opts.datacenter

  const data = await billmanagerRequest(baseUrl, authinfo, 'vds.order', params)

  const tariflist = extractTariflist(data)
  const listNode = (data.list as Record<string, unknown>) ?? (data.doc as Record<string, unknown>)?.list
  const slist = ((listNode as Record<string, unknown>)?.slist ?? data.slist ?? {}) as Record<string, unknown>
  if (tariflist.length === 0) return { tariffItems: [], slist }

  const tariffItems = tariflist.map((rawItem) => {
    const item = elemToObject(rawItem)
    const parsed = parseTariffDesc(item.desc || '')
    const descClean = (item.desc || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    const name = parsed.name || parsed.cpuModel || item.price?.split(' ')[0] || '—'
    return {
      externalId: String(item.pricelist || ''),
      name,
      desc: descClean,
      vcpu: parsed.vcpu,
      ramGb: parsed.ramGb,
      diskGb: parsed.diskGb,
      diskType: parsed.diskType,
      virtualization: parsed.virtualization,
      channel: parsed.channel,
      location: parsed.location,
      cpuModel: parsed.cpuModel,
      orderAvailable: (item.order_available || '').toLowerCase() === 'on',
      price: item.price || '',
    }
  })

  return { tariffItems, slist }
}

export async function fetchVdsOrderPricelistAllDatacenters(
  baseUrl: string,
  authinfo: string,
): Promise<{ tariffItems: TariffItem[]; slist: Record<string, unknown> }> {
  const initial = await fetchVdsOrderPricelist(baseUrl, authinfo)
  const slist = initial.slist || {}
  const datacenters = Array.isArray(slist.datacenter) ? slist.datacenter : []

  if (datacenters.length === 0) {
    return { tariffItems: initial.tariffItems, slist }
  }

  const allTariffItems: TariffItem[] = []

  for (let i = 0; i < datacenters.length; i++) {
    const dc = datacenters[i] as Record<string, unknown>
    const dcKey = String(dc.k ?? dc.key ?? '')
    const dcName = String(dc.v ?? dc.value ?? dc.name ?? '')
    const { country, location } = parseDatacenterName(dcName)

    const result =
      i === 0 ? initial : await fetchVdsOrderPricelist(baseUrl, authinfo, { datacenter: dcKey })
    for (const t of result.tariffItems) {
      allTariffItems.push({
        ...t,
        datacenterKey: dcKey,
        datacenterName: dcName,
        country,
        location: location || dcName,
      })
    }
  }

  return { tariffItems: allTariffItems, slist }
}

export async function testConnection(
  baseUrl: string,
  authinfo: string,
): Promise<{ ok: boolean; error?: string; vdsCount?: number }> {
  if (!baseUrl?.trim() || !authinfo?.trim()) {
    return { ok: false, error: 'Укажите URL и учётные данные' }
  }
  try {
    const items = await fetchVds(baseUrl.trim(), authinfo.trim())
    return { ok: true, vdsCount: items?.length ?? 0 }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Ошибка подключения'
    return { ok: false, error: message }
  }
}
