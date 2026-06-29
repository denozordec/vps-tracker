/**
 * RuVDS API v2 → vps-tracker model mappers
 */

import { createHash } from 'node:crypto'

import type { RuvdsDatacenter, RuvdsOsItem, RuvdsPayment, RuvdsServer } from './types.js'
import { ruvdsCurrencyCode } from './operations.js'

const STATUS_MAP: Record<string, string> = {
  active: 'active',
  new: 'active',
  notpaid: 'paused',
  blocked: 'paused',
  deleted: 'archived',
  removed: 'archived',
}

function dateToIso(value: string | undefined | null): string {
  if (!value) return ''
  return String(value).slice(0, 10)
}

function roundRate(n: number): number {
  return Math.round(n * 100) / 100
}

function paymentPeriodMonths(period: number | undefined): number {
  switch (period) {
    case 2:
      return 1
    case 3:
      return 3
    case 4:
      return 6
    case 5:
      return 12
    default:
      return 1
  }
}

function ratesFromCost(
  costRub: number | null | undefined,
  paymentPeriod: number | undefined,
): { tariffType: string; dailyRate: number | null; monthlyRate: number | null } {
  if (costRub == null || !Number.isFinite(costRub) || costRub <= 0) {
    return { tariffType: 'monthly', dailyRate: null, monthlyRate: null }
  }
  const months = paymentPeriodMonths(paymentPeriod)
  const monthlyRate = roundRate(costRub / months)
  return { tariffType: 'monthly', dailyRate: null, monthlyRate }
}

function parseDatacenterName(name: string): { city: string; country: string; datacenter: string } {
  const trimmed = name.trim()
  if (!trimmed) return { city: '', country: 'RU', datacenter: '' }
  const parts = trimmed.split(':').map((p) => p.trim())
  if (parts.length >= 2) {
    const location = parts[1]
    const comma = location.split(',').map((p) => p.trim())
    const country = comma.length >= 2 ? comma[0] : 'RU'
    const city = comma.length >= 2 ? comma[1] : location
    return { city, country: country.length <= 3 ? country.toUpperCase() : 'RU', datacenter: trimmed }
  }
  return { city: '', country: 'RU', datacenter: trimmed }
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
  vpsId: null
  note: string
}

export interface RuvdsLookupMaps {
  datacenters: Map<number, RuvdsDatacenter>
  os: Map<number, RuvdsOsItem>
  costs: Map<number, number>
}

export function buildLookupMaps(
  datacenters: RuvdsDatacenter[],
  osList: RuvdsOsItem[],
  costs: Map<number, number>,
): RuvdsLookupMaps {
  return {
    datacenters: new Map(datacenters.map((d) => [d.id, d])),
    os: new Map(osList.map((o) => [o.id, o])),
    costs,
  }
}

export function mapServerToVps(
  server: RuvdsServer,
  providerId: string,
  providerAccountId: string,
  fallbackCurrency: string,
  lookups: RuvdsLookupMaps,
): MappedVps {
  const externalId = String(server.virtual_server_id)
  const networks = server.network_v4 ?? []
  const ipv4List = networks.map((n) => String(n.ip_address || '').trim()).filter(Boolean)
  const ip = ipv4List[0] ?? ''
  const additionalIps = ipv4List.slice(1)

  const dc = server.datacenter != null ? lookups.datacenters.get(server.datacenter) : undefined
  const dcParsed = parseDatacenterName(dc?.name ?? '')
  const osItem = server.os_id != null ? lookups.os.get(server.os_id) : undefined
  const status = STATUS_MAP[String(server.status ?? '').toLowerCase()] ?? 'active'

  const diskGb =
    (Number(server.drive) || 0) + (Number(server.additional_drive) || 0) || Number(server.drive) || 0
  const costRub = lookups.costs.get(server.virtual_server_id)
  const { tariffType, dailyRate, monthlyRate } = ratesFromCost(costRub, server.payment_period)

  const comment = String(server.user_comment ?? '').trim()
  const marker = `ruvds-${externalId}`
  const notes = comment ? `${comment} [${marker}]` : `[${marker}]`
  const dns = comment || `RU${externalId}`

  return {
    externalId,
    ip,
    dns,
    ipv6: '',
    additionalIps,
    providerId,
    providerAccountId,
    country: (dc?.country ?? dcParsed.country).toUpperCase() || 'RU',
    city: dcParsed.city,
    datacenter: dcParsed.datacenter,
    os: osItem?.name ?? '',
    vcpu: Number(server.cpu) || 0,
    ramGb: Number(server.ram) || 0,
    diskGb,
    diskType: 'SSD',
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
    tariffType,
    currency: fallbackCurrency,
    dailyRate,
    monthlyRate,
    createdAt: '',
    paidUntil: dateToIso(server.paid_till),
    notes,
  }
}

function paymentExternalId(payment: RuvdsPayment): string {
  const raw = `${payment.dt}|${payment.direction}|${payment.amount}|${payment.pay_source ?? ''}`
  return createHash('sha256').update(raw).digest('hex').slice(0, 16)
}

export function mapPaymentToPayment(
  payment: RuvdsPayment,
  providerAccountId: string,
  fallbackCurrency: string,
): MappedPayment | null {
  if (payment.direction !== 1) return null
  const amount = Number(payment.amount)
  if (!Number.isFinite(amount) || amount <= 0) return null
  const externalId = paymentExternalId(payment)
  const currency = ruvdsCurrencyCode(payment.currency, fallbackCurrency)
  const date = dateToIso(payment.dt) || new Date().toISOString().slice(0, 10)
  const source = String(payment.pay_source ?? '').trim()
  return {
    externalId,
    type: 'topup',
    date,
    amount,
    currency,
    providerAccountId,
    vpsId: null,
    note: source ? `ruvds-${externalId} ${source}` : `ruvds-${externalId}`,
  }
}
