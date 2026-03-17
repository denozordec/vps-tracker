/**
 * BILLmanager API operations — fetch VDS, payments, dashboard, tariffs
 */

import { billmanagerRequest } from './client.js'
import { extractList, elemToObject, parseTariffDesc, parseDatacenterName, extractTariflist } from './parsers.js'

/**
 * @param {string} baseUrl
 * @param {string} authinfo
 * @returns {Promise<object[]>} list of vps objects (raw BILLmanager format)
 */
export async function fetchVds(baseUrl, authinfo) {
  const data = await billmanagerRequest(baseUrl, authinfo, 'vds')
  const elems = extractList(data, 'vds')
  return elems.map((e) => elemToObject(e))
}

/**
 * Получить текущий баланс аккаунта (dashboard.info)
 * @param {string} baseUrl - e.g. https://billing.example.com/billmgr
 * @param {string} authinfo - username:password
 * @param {object} [opts] - { fallbackCurrency } — валюта аккаунта, если API не возвращает
 * @returns {Promise<{ balance: number, currency: string, enoughmoneyto?: string, realbalance?: string }>}
 */
export async function fetchDashboardInfo(baseUrl, authinfo, opts = {}) {
  const data = await billmanagerRequest(baseUrl, authinfo, 'dashboard.info', {
    dashboard: 'info',
    sfrom: 'ajax',
  })
  const elems = extractList(data, 'dashboard') || (Array.isArray(data.elem) ? data.elem : [])
  const item = elems.length > 0 ? elemToObject(elems[0]) : {}
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

/**
 * @param {string} baseUrl - e.g. https://billing.example.com/billmgr
 * @param {string} authinfo - username:password
 * @param {object} [opts] - { createdatestart, createdateend } — опционально, не все API поддерживают
 * @returns {Promise<object[]>} list of payment objects
 */
export async function fetchPayments(baseUrl, authinfo, opts = {}) {
  const params = {}
  if (opts.createdatestart) params.createdatestart = opts.createdatestart
  if (opts.createdateend) params.createdateend = opts.createdateend
  if (opts.createdate === 'other') params.createdate = 'other'
  if (opts.filter === 'on') params.filter = 'on'
  if (opts.status != null) params.status = String(opts.status)
  const data = await billmanagerRequest(baseUrl, authinfo, 'payment', params)
  const elems = extractList(data, 'payment')
  return elems.map((e) => elemToObject(e))
}

/**
 * Получить список активных тарифов для заказа VDS (vds.order) для одного датацентра
 * @param {string} baseUrl
 * @param {string} authinfo
 * @param {object} [opts] - { plid, period, datacenter }
 * @returns {Promise<{ tariffItems: object[], slist: object }>}
 */
export async function fetchVdsOrderPricelist(baseUrl, authinfo, opts = {}) {
  const params = {
    plid: opts.plid || '',
    sfrom: 'ajax',
  }
  if (opts.period) params.period = opts.period
  if (opts.datacenter) params.datacenter = opts.datacenter

  const data = await billmanagerRequest(baseUrl, authinfo, 'vds.order', params)

  const tariflist = extractTariflist(data)
  const slist = data?.list?.slist ?? data?.slist ?? {}
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

/**
 * Получить тарифы по всем датацентрам — отдельный запрос на каждый ДЦ.
 * @param {string} baseUrl
 * @param {string} authinfo
 * @returns {Promise<{ tariffItems: object[], slist: object }>}
 */
export async function fetchVdsOrderPricelistAllDatacenters(baseUrl, authinfo) {
  const initial = await fetchVdsOrderPricelist(baseUrl, authinfo)
  const slist = initial.slist || {}
  const datacenters = Array.isArray(slist.datacenter) ? slist.datacenter : []

  if (datacenters.length === 0) {
    return { tariffItems: initial.tariffItems, slist }
  }

  const allTariffItems = []

  for (let i = 0; i < datacenters.length; i++) {
    const dc = datacenters[i]
    const dcKey = String(dc.k ?? dc.key ?? '')
    const dcName = String(dc.v ?? dc.value ?? dc.name ?? '')
    const { country, location } = parseDatacenterName(dcName)

    const result = i === 0 ? initial : await fetchVdsOrderPricelist(baseUrl, authinfo, { datacenter: dcKey })
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

/**
 * Test API connection — запрос списка VDS
 * @param {string} baseUrl
 * @param {string} authinfo - username:password
 * @returns {Promise<{ ok: boolean, error?: string, vdsCount?: number }>}
 */
export async function testConnection(baseUrl, authinfo) {
  if (!baseUrl?.trim() || !authinfo?.trim()) {
    return { ok: false, error: 'Укажите URL и учётные данные' }
  }
  try {
    const items = await fetchVds(baseUrl.trim(), authinfo.trim())
    return { ok: true, vdsCount: items?.length ?? 0 }
  } catch (err) {
    return { ok: false, error: err.message || 'Ошибка подключения' }
  }
}
