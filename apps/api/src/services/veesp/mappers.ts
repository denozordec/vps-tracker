/**
 * Veesp API response → vps-tracker model mappers
 */

import type { VeespInvoice, VeespVpsRecord } from './operations.js'

const STATUS_MAP: Record<string, string> = {
  active: 'active',
  pending: 'paused',
  suspended: 'paused',
  paused: 'paused',
  cancelled: 'archived',
  canceled: 'archived',
  terminated: 'archived',
  deleted: 'archived',
}

function dateToIso(value: string | undefined | null): string {
  if (!value) return ''
  return String(value).slice(0, 10)
}

function parseNumber(raw: string | number | undefined | null): number {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : 0
  const n = Number.parseFloat(String(raw ?? '').replace(/[^\d.-]/g, ''))
  return Number.isFinite(n) ? n : 0
}

function roundRate(n: number): number {
  return Math.round(n * 100) / 100
}

function mapBillingCycle(cycle: string | undefined): {
  tariffType: string
  dailyRate: number | null
  monthlyRate: number | null
} {
  const c = String(cycle ?? '').toLowerCase()
  return { tariffType: c.includes('day') ? 'daily' : 'monthly', dailyRate: null, monthlyRate: null }
}

function ratesFromTotal(
  total: number,
  cycle: string | undefined,
): { tariffType: string; dailyRate: number | null; monthlyRate: number | null } {
  const base = mapBillingCycle(cycle)
  const c = String(cycle ?? '').toLowerCase()
  if (c.includes('day')) {
    return { tariffType: 'daily', dailyRate: roundRate(total), monthlyRate: null }
  }
  if (c.includes('week')) {
    return { tariffType: 'daily', dailyRate: roundRate(total / 7), monthlyRate: null }
  }
  if (c.includes('quarter')) {
    return { tariffType: 'monthly', dailyRate: null, monthlyRate: roundRate(total / 3) }
  }
  if (c.includes('semi') || c.includes('6')) {
    return { tariffType: 'monthly', dailyRate: null, monthlyRate: roundRate(total / 6) }
  }
  if (c.includes('annual') || c.includes('year')) {
    return { tariffType: 'monthly', dailyRate: null, monthlyRate: roundRate(total / 12) }
  }
  return { tariffType: 'monthly', dailyRate: null, monthlyRate: roundRate(total) }
}

function isIpv4(value: string): boolean {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(value)
}

function isIpv6(value: string): boolean {
  return value.includes(':')
}

function normalizeIpField(raw: string | string[] | undefined | null): string {
  if (raw == null) return ''
  if (Array.isArray(raw)) {
    let fallback = ''
    for (const item of raw) {
      const ip = String(item).trim()
      if (!ip) continue
      if (isIpv4(ip)) return ip
      if (!fallback && isIpv6(ip)) fallback = ip
    }
    return fallback
  }
  return String(raw).trim()
}

function ipFromItem(item: { ip?: string; address?: string; ipaddress?: string }): string {
  return String(item.ip ?? item.address ?? item.ipaddress ?? '').trim()
}

function parseMemoryGb(raw: string | number | undefined | null): number {
  const n = parseNumber(raw)
  if (n <= 0) return 0
  // Veesp VM/info API returns memory in MB (512, 1024, 2048…)
  if (n >= 256) return Math.round((n / 1024) * 10) / 10
  return n
}

function pickPrimaryIp(
  ips: VeespVpsRecord['ips'],
  vm: VeespVpsRecord['vm'],
  info: VeespVpsRecord['info'],
  domain?: string,
): string {
  const vmIp = normalizeIpField(vm?.ip ?? vm?.ipv4)
  if (vmIp) return vmIp

  const infoIp = normalizeIpField(info?.ip)
  if (infoIp) return infoIp

  for (const item of ips) {
    const ip = ipFromItem(item)
    if (!ip) continue
    if (item.main === true || item.main === 1 || String(item.main) === '1') return ip
  }
  for (const item of ips) {
    const ip = ipFromItem(item)
    if (ip) return ip
  }
  const d = String(domain ?? '').trim()
  if (isIpv4(d)) return d
  return ''
}

function pickServiceStatus(...values: (string | undefined)[]): string | undefined {
  for (const value of values) {
    const key = String(value ?? '').toLowerCase()
    if (key && STATUS_MAP[key] && STATUS_MAP[key] !== 'active') return value
  }
  return values.find(Boolean)
}

function mapStatus(serviceStatus?: string, vmStatus?: string): string {
  const serviceKey = String(serviceStatus ?? '').toLowerCase()
  const vmKey = String(vmStatus ?? '').toLowerCase()
  const serviceMapped = STATUS_MAP[serviceKey]
  const vmMapped = STATUS_MAP[vmKey]
  if (serviceMapped && serviceMapped !== 'active') return serviceMapped
  if (vmMapped) return vmMapped
  return 'active'
}

export interface MappedVps {
  externalId: string
  ip: string
  dns: string
  ipv6: string
  additionalIps: string[]
  providerId: string
  providerAccountId: string
  country: string
  city: string
  datacenter: string
  os: string
  vcpu: number
  ramGb: number
  diskGb: number
  diskType: string
  virtualization: string
  bandwidthTb: number
  sshPort: number
  rootUser: string
  purpose: string
  environment: string
  project: string
  monitoringEnabled: boolean
  backupEnabled: boolean
  status: string
  tariffType: string
  currency: string
  dailyRate: number | null
  monthlyRate: number | null
  createdAt: string
  paidUntil: string
  notes: string
}

export interface MappedPayment {
  externalId: string
  type: string
  date: string
  amount: number
  currency: string
  providerAccountId: string
  vpsId: string | null
  note: string
}

export function mapVpsRecordToVps(
  record: VeespVpsRecord,
  providerId: string,
  providerAccountId: string,
  currency: string,
): MappedVps {
  const { service, serviceDetail, vm, info, ips, serviceId, vmId } = record
  const externalId = vmId ? `${serviceId}-${vmId}` : serviceId
  const detail = serviceDetail ?? service
  const total = parseNumber(detail.total ?? service.total)
  const rates = ratesFromTotal(total, detail.billingcycle ?? service.billingcycle)
  const hostname = String(
    vm?.hostname ??
      vm?.name ??
      vm?.label ??
      info?.hostname ??
      detail.domain ??
      service.domain ??
      detail.name ??
      service.name ??
      '',
  ).trim()
  const ip = pickPrimaryIp(ips, vm, info, detail.domain ?? service.domain)
  const os = String(
    vm?.os ?? vm?.template ?? vm?.template_label ?? info?.os ?? info?.template ?? info?.template_label ?? '',
  ).trim()
  const vcpu = parseNumber(vm?.cpu ?? vm?.cores ?? vm?.cpus ?? info?.cpu ?? info?.cpus)
  const ramGb = parseMemoryGb(vm?.ram ?? vm?.memory ?? info?.ram ?? info?.ramGb ?? info?.memory)
  const diskGb = parseNumber(vm?.disk ?? info?.disk ?? info?.hdd)
  const status = mapStatus(
    pickServiceStatus(service.status, detail.status),
    vm?.status ?? vm?.state,
  )
  const label = hostname || ip || detail.name || service.name || externalId

  return {
    externalId,
    ip,
    dns: hostname,
    ipv6: '',
    additionalIps: [],
    providerId,
    providerAccountId,
    country: '',
    city: '',
    datacenter: String(service.category ?? '').trim(),
    os,
    vcpu,
    ramGb,
    diskGb,
    diskType: 'NVMe',
    virtualization: 'KVM',
    bandwidthTb: 0,
    sshPort: 22,
    rootUser: 'root',
    purpose: '',
    environment: '',
    project: '',
    monitoringEnabled: false,
    backupEnabled: false,
    status,
    tariffType: rates.tariffType,
    currency,
    dailyRate: rates.dailyRate,
    monthlyRate: rates.monthlyRate,
    createdAt: dateToIso(detail.date_created),
    paidUntil: dateToIso(detail.next_due ?? service.next_due),
    notes: label ? `${label} [veesp-${externalId}]` : `veesp-${externalId}`,
  }
}

export function mapInvoiceToPayment(
  invoice: VeespInvoice,
  accountId: string,
  fallbackCurrency: string,
): MappedPayment | null {
  const status = String(invoice.status ?? '').toLowerCase()
  if (status !== 'paid') return null
  const id = invoice.id
  if (id == null) return null
  const amount = parseNumber(invoice.total)
  if (amount <= 0) return null
  const currency = String(invoice.currency ?? fallbackCurrency).trim() || fallbackCurrency
  const date = dateToIso(invoice.datepaid ?? invoice.date ?? invoice.dateorig)
  return {
    externalId: String(id),
    type: 'topup',
    date: date || new Date().toISOString().slice(0, 10),
    amount,
    currency,
    providerAccountId: accountId,
    vpsId: null,
    note: `veesp-invoice-${id}`,
  }
}
