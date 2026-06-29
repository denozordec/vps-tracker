/**
 * Veesp client area API operations
 */

import { createVeespClient, VeespApiError, type VeespClient } from './client.js'

export const VEESP_VPS_CATEGORY_SLUGS = [
  'virtual-private-servers',
  'virtual-private-server',
  'vps',
  'proxmox',
] as const

export interface VeespServiceListItem {
  id: string | number
  domain?: string
  total?: string | number
  status?: string
  billingcycle?: string
  next_due?: string
  category?: string
  category_url?: string
  name?: string
}

export interface VeespServiceDetail {
  id?: string | number
  date_created?: string
  domain?: string
  firstpayment?: string | number
  total?: string | number
  billingcycle?: string
  next_due?: string
  next_invoice?: string
  status?: string
  label?: string
  name?: string
}

export interface VeespVmListItem {
  id?: string | number
  vmid?: string | number
  name?: string
  label?: string
  hostname?: string
  status?: string
  state?: string
  ip?: string | string[]
  ipv4?: string | string[]
  template?: string
  template_label?: string
  os?: string
  cpus?: string | number
}

export interface VeespVmDetail extends VeespVmListItem {
  ram?: number | string
  cpu?: number | string
  disk?: number | string
  memory?: number | string
  cores?: number | string
}

export interface VeespIpItem {
  ip?: string
  address?: string
  ipaddress?: string
  type?: string
  main?: boolean | number | string
}

export interface VeespServiceInfo {
  os?: string
  template?: string
  template_label?: string
  cpu?: number | string
  cpus?: number | string
  ram?: number | string
  ramGb?: number | string
  memory?: number | string
  disk?: number | string
  hdd?: number | string
  hostname?: string
  ip?: string | string[]
}

export interface VeespInvoice {
  id?: string | number
  date?: string
  dateorig?: string
  duedate?: string
  total?: string | number
  datepaid?: string
  status?: string
  number?: string
  currency?: string
}

export interface VeespCategory {
  id?: string | number
  name?: string
  slug?: string
  description?: string
}

export interface VeespProduct {
  id?: string | number
  name?: string
  description?: string
  paytype?: string
  pricing?: Record<string, Record<string, string | number>>
  configoptions?: unknown
}

export interface VeespBalanceResult {
  balance: number
  currency: string
  enoughmoneyto: string
}

export interface VeespTariffItem {
  externalId: string
  datacenterKey: string
  datacenterName: string
  name: string
  desc: string
  vcpu: number
  ramGb: number
  diskGb: number
  diskType: string
  virtualization: string
  channel: string
  location: string
  country: string
  cpuModel: string
  orderAvailable: boolean
  price: string
}

export interface VeespVpsRecord {
  serviceId: string
  vmId: string | null
  service: VeespServiceListItem
  serviceDetail: VeespServiceDetail | null
  vm: VeespVmDetail | null
  ips: VeespIpItem[]
  info: VeespServiceInfo | null
}

function clientFor(baseUrl: string, credentials: string): VeespClient {
  return createVeespClient(baseUrl, credentials)
}

function parseAmount(raw: string | number | undefined | null): number {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : 0
  const n = Number.parseFloat(String(raw ?? '').replace(/[^\d.-]/g, ''))
  return Number.isFinite(n) ? n : 0
}

function normalizeSlug(value: string | undefined | null): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/_/g, '-')
}

function isVpsCategorySlug(slug: string): boolean {
  const s = normalizeSlug(slug)
  if (!s) return false
  if (VEESP_VPS_CATEGORY_SLUGS.some((v) => s === v || s.includes(v))) return true
  return s.includes('vps') || s.includes('virtual-private')
}

export function isVpsService(service: VeespServiceListItem, vpsCategoryIds?: Set<string>): boolean {
  const slug = normalizeSlug(service.category_url)
  const category = String(service.category ?? '').toLowerCase()
  if (isVpsCategorySlug(slug)) return true
  if (category.includes('vps') || category.includes('virtual private') || category.includes('proxmox')) {
    return true
  }
  if (vpsCategoryIds && service.category_url) {
    const catKey = normalizeSlug(service.category_url)
    if (vpsCategoryIds.has(catKey)) return true
  }
  return false
}

function unwrapKeyedList<T extends Record<string, unknown>>(raw: unknown): T[] {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return []
  const out: T[] = []
  for (const [key, item] of Object.entries(raw as Record<string, unknown>)) {
    if (item == null) continue
    if (typeof item === 'string') {
      out.push({ ip: item, id: key } as unknown as T)
      continue
    }
    if (typeof item !== 'object') continue
    const row = item as Record<string, unknown>
    out.push({ ...row, id: row.id ?? key } as T)
  }
  return out
}

function unwrapList<T>(json: unknown, key: string): T[] {
  if (Array.isArray(json)) {
    return json.map((item) => {
      if (typeof item === 'string') return { ip: item } as T
      return item as T
    })
  }
  if (json && typeof json === 'object') {
    const obj = json as Record<string, unknown>
    const list = obj[key]
    if (Array.isArray(list)) {
      return list.map((item) => {
        if (typeof item === 'string') return { ip: item } as T
        return item as T
      })
    }
    if (list && typeof list === 'object') {
      return unwrapKeyedList<T>(list)
    }
    const vms = obj.vms
    if (Array.isArray(vms)) return vms as T[]
    if (vms && typeof vms === 'object') return unwrapKeyedList<T>(vms)
  }
  return []
}

function unwrapObject<T>(json: unknown, key: string): T | null {
  if (!json || typeof json !== 'object') return null
  const obj = json as Record<string, unknown>
  const nested = obj[key]
  if (nested && typeof nested === 'object') return nested as T
  return obj as T
}

export async function fetchServices(baseUrl: string, credentials: string): Promise<VeespServiceListItem[]> {
  const client = clientFor(baseUrl, credentials)
  const json = await client.request<unknown>('/service')
  return unwrapList<VeespServiceListItem>(json, 'services')
}

export async function fetchServiceDetail(
  baseUrl: string,
  credentials: string,
  serviceId: string | number,
): Promise<VeespServiceDetail | null> {
  const client = clientFor(baseUrl, credentials)
  try {
    const json = await client.request<unknown>(`/service/${serviceId}`)
    return unwrapObject<VeespServiceDetail>(json, 'service')
  } catch {
    return null
  }
}

export async function fetchVms(
  baseUrl: string,
  credentials: string,
  serviceId: string | number,
): Promise<VeespVmListItem[]> {
  const client = clientFor(baseUrl, credentials)
  try {
    const json = await client.request<unknown>(`/service/${serviceId}/vms`)
    return unwrapList<VeespVmListItem>(json, 'vms')
  } catch (err) {
    if (err instanceof VeespApiError && /404|not found/i.test(err.message)) return []
    throw err
  }
}

export async function fetchVmDetail(
  baseUrl: string,
  credentials: string,
  serviceId: string | number,
  vmId: string | number,
): Promise<VeespVmDetail | null> {
  const client = clientFor(baseUrl, credentials)
  try {
    const json = await client.request<unknown>(`/service/${serviceId}/vms/${vmId}`)
    if (!json || typeof json !== 'object') return null
    const obj = json as Record<string, unknown>
    const nested = unwrapObject<VeespVmDetail>(json, 'vm') ?? unwrapObject<VeespVmDetail>(json, 'vms')
    if (nested) return { ...nested, id: nested.id ?? vmId }
    const keyed = unwrapKeyedList<VeespVmDetail>(obj.vms ?? obj.vm ?? obj)
    const match = keyed.find((row) => String(row.id ?? row.vmid) === String(vmId))
    return match ?? (keyed[0] ? { ...keyed[0], id: keyed[0].id ?? vmId } : null)
  } catch {
    return null
  }
}

export async function fetchServiceIps(
  baseUrl: string,
  credentials: string,
  serviceId: string | number,
): Promise<VeespIpItem[]> {
  const client = clientFor(baseUrl, credentials)
  try {
    const json = await client.request<unknown>(`/service/${serviceId}/ips`)
    return unwrapList<VeespIpItem>(json, 'ips')
  } catch {
    return []
  }
}

export async function fetchServiceInfo(
  baseUrl: string,
  credentials: string,
  serviceId: string | number,
): Promise<VeespServiceInfo | null> {
  const client = clientFor(baseUrl, credentials)
  try {
    const json = await client.request<unknown>(`/service/${serviceId}/info`)
    return unwrapObject<VeespServiceInfo>(json, 'info') ?? unwrapObject<VeespServiceInfo>(json, 'server') ?? (json as VeespServiceInfo)
  } catch {
    return null
  }
}

export async function fetchCategories(baseUrl: string, credentials: string): Promise<VeespCategory[]> {
  const client = clientFor(baseUrl, credentials)
  const json = await client.request<unknown>('/category')
  return unwrapList<VeespCategory>(json, 'categories')
}

export async function fetchVpsCategoryIds(baseUrl: string, credentials: string): Promise<Set<string>> {
  const categories = await fetchCategories(baseUrl, credentials)
  const ids = new Set<string>()
  for (const cat of categories) {
    const slug = normalizeSlug(cat.slug)
    if (isVpsCategorySlug(slug) || String(cat.name ?? '').toLowerCase().includes('vps')) {
      if (slug) ids.add(slug)
      if (cat.id != null) ids.add(String(cat.id))
    }
  }
  return ids
}

export async function fetchProducts(
  baseUrl: string,
  credentials: string,
  categoryId: string | number,
): Promise<VeespProduct[]> {
  const client = clientFor(baseUrl, credentials)
  try {
    const json = await client.request<unknown>(`/category/${categoryId}/product`)
    return unwrapList<VeespProduct>(json, 'products')
  } catch {
    return []
  }
}

export async function fetchBalance(
  baseUrl: string,
  credentials: string,
  fallbackCurrency = 'EUR',
): Promise<VeespBalanceResult> {
  const client = clientFor(baseUrl, credentials)
  const json = await client.request<Record<string, unknown>>('/balance')
  const details =
    (json.details as Record<string, unknown> | undefined) ??
    (json.balance as Record<string, unknown> | undefined) ??
    json
  const currency = String(details.currency ?? fallbackCurrency).trim() || fallbackCurrency
  const balance = parseAmount(details.acc_balance as string | number | undefined)
  return { balance, currency, enoughmoneyto: '' }
}

export async function fetchInvoices(baseUrl: string, credentials: string): Promise<VeespInvoice[]> {
  const client = clientFor(baseUrl, credentials)
  const json = await client.request<unknown>('/invoice')
  return unwrapList<VeespInvoice>(json, 'invoices')
}

function extractProductPrice(product: VeespProduct, currency: string): string {
  const pricing = product.pricing
  if (!pricing || typeof pricing !== 'object') return ''
  const cur = currency.toUpperCase()
  const bucket =
    (pricing[cur] as Record<string, string | number> | undefined) ??
    (pricing[currency.toLowerCase()] as Record<string, string | number> | undefined) ??
    (Object.values(pricing)[0] as Record<string, string | number> | undefined)
  if (!bucket) return ''
  const monthly = bucket.monthly ?? bucket.Monthly
  const monthlyVal = monthly ?? bucket.quarterly ?? bucket.annually ?? bucket.semiannually
  if (monthlyVal == null) return ''
  return `${parseAmount(monthlyVal)} ${cur}/month`
}

export async function fetchTariffList(
  baseUrl: string,
  credentials: string,
  currency = 'EUR',
): Promise<VeespTariffItem[]> {
  const categories = await fetchCategories(baseUrl, credentials)
  const vpsCategories = categories.filter((cat) => {
    const slug = normalizeSlug(cat.slug)
    return isVpsCategorySlug(slug) || String(cat.name ?? '').toLowerCase().includes('vps')
  })

  const items: VeespTariffItem[] = []
  for (const cat of vpsCategories) {
    if (cat.id == null) continue
    const products = await fetchProducts(baseUrl, credentials, cat.id)
    const catKey = String(cat.id)
    const catName = cat.name || cat.slug || catKey
    for (const product of products) {
      if (product.id == null) continue
      items.push({
        externalId: String(product.id),
        datacenterKey: catKey,
        datacenterName: catName,
        name: product.name || '',
        desc: product.description || '',
        vcpu: 0,
        ramGb: 0,
        diskGb: 0,
        diskType: 'NVMe',
        virtualization: 'KVM',
        channel: '',
        location: catName,
        country: '',
        cpuModel: '',
        orderAvailable: true,
        price: extractProductPrice(product, currency),
      })
    }
  }
  return items
}

function vmExternalId(serviceId: string, vm: VeespVmListItem): string {
  const vmId = vm.id ?? vm.vmid
  return vmId != null ? `${serviceId}-${vmId}` : serviceId
}

export async function fetchVpsRecords(
  baseUrl: string,
  credentials: string,
  concurrency = 10,
): Promise<VeespVpsRecord[]> {
  const [services, vpsCategoryIds] = await Promise.all([
    fetchServices(baseUrl, credentials),
    fetchVpsCategoryIds(baseUrl, credentials).catch(() => new Set<string>()),
  ])

  const vpsServices = services.filter((s) => isVpsService(s, vpsCategoryIds))
  const records: VeespVpsRecord[] = []

  for (let i = 0; i < vpsServices.length; i += concurrency) {
    const batch = vpsServices.slice(i, i + concurrency)
    const batchRecords = await Promise.all(
      batch.map(async (service) => {
        const serviceId = String(service.id)
        const [serviceDetail, vms, ips, info] = await Promise.all([
          fetchServiceDetail(baseUrl, credentials, serviceId),
          fetchVms(baseUrl, credentials, serviceId),
          fetchServiceIps(baseUrl, credentials, serviceId),
          fetchServiceInfo(baseUrl, credentials, serviceId),
        ])

        if (vms.length === 0) {
          return [
            {
              serviceId,
              vmId: null,
              service,
              serviceDetail,
              vm: null,
              ips,
              info,
            } satisfies VeespVpsRecord,
          ]
        }

        const vmDetails = await Promise.all(
          vms.map(async (vm) => {
            const vmId = vm.id ?? vm.vmid
            if (vmId == null) return vm as VeespVmDetail
            const detail = await fetchVmDetail(baseUrl, credentials, serviceId, vmId)
            return { ...vm, ...detail } as VeespVmDetail
          }),
        )

        return vmDetails.map((vm) => ({
          serviceId,
          vmId: String(vm.id ?? vm.vmid ?? vmExternalId(serviceId, vm)),
          service,
          serviceDetail,
          vm,
          ips,
          info,
        }))
      }),
    )
    records.push(...batchRecords.flat())
  }

  return records
}

/** Парсинг коллекций Veesp API (object-map и массивы) — для тестов и отладки */
export function parseVeespCollection<T>(json: unknown, key: string): T[] {
  return unwrapList<T>(json, key)
}

export async function testConnection(
  baseUrl: string,
  credentials: string,
): Promise<{ ok: boolean; error?: string; vdsCount?: number; balance?: number }> {
  if (!baseUrl?.trim() || !credentials?.trim()) {
    return { ok: false, error: 'Укажите URL и учётные данные' }
  }
  try {
    const [balanceInfo, records] = await Promise.all([
      fetchBalance(baseUrl, credentials),
      fetchVpsRecords(baseUrl, credentials),
    ])
    return { ok: true, vdsCount: records.length, balance: balanceInfo.balance }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Ошибка подключения'
    return { ok: false, error: message }
  }
}
