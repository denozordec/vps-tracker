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

function pickPrimaryIp(ips: VeespVpsRecord['ips'], vm: VeespVpsRecord['vm'], domain?: string): string {
  const vmIp = String(vm?.ip ?? vm?.ipv4 ?? '').trim()
  if (vmIp) return vmIp

  for (const item of ips) {
    const ip = String(item.ip ?? item.address ?? '').trim()
    if (!ip) continue
    if (item.main === true || item.main === 1 || String(item.main) === '1') return ip
  }
  for (const item of ips) {
    const ip = String(item.ip ?? item.address ?? '').trim()
    if (ip) return ip
  }
  const d = String(domain ?? '').trim()
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(d)) return d
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
    vm?.hostname ?? vm?.name ?? info?.hostname ?? detail.domain ?? service.domain ?? detail.name ?? service.name ?? '',
  ).trim()
  const ip = pickPrimaryIp(ips, vm, detail.domain ?? service.domain)
  const os = String(vm?.os ?? vm?.template ?? info?.os ?? info?.template ?? '').trim()
  const vcpu = parseNumber(vm?.cpu ?? vm?.cores ?? info?.cpu)
  const ramGb = parseNumber(vm?.ram ?? vm?.memory ?? info?.ram ?? info?.memory)
  const diskGb = parseNumber(vm?.disk ?? info?.disk)
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
