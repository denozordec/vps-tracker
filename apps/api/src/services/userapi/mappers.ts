/**
 * UserAPI response → vps-tracker model mappers
 */

import { parseTariffPrice } from '@cfdm/db/repositories/tariffs'
import type { UserApiType } from '@cfdm/shared/contracts/provider'

import type {
  UserApiOperation,
  UserApiPlanCostIndex,
  UserApiServerDetail,
  UserApiServerPlan,
  UserApiTariffItem,
} from './operations.js'
import { inferPlanPeriod, effectivePlanCost, findPlanInIndex, parsePlanCost } from './operations.js'

const STATUS_MAP: Record<string, string> = {
  active: 'active',
  new: 'active',
  block: 'paused',
  notpaid: 'paused',
  deleted: 'archived',
}

function dateToIso(value: string | undefined | null): string {
  if (!value) return ''
  return String(value).slice(0, 10)
}

function inferDiskType(name: string): string {
  const upper = name.toUpperCase()
  if (upper.includes('NVME')) return 'NVMe'
  if (upper.includes('SSD')) return 'SSD'
  if (upper.includes('HDD')) return 'HDD'
  return 'NVMe'
}

function extractIp(server: UserApiServerDetail): { ip: string; ipv6: string } {
  const ipObj = server.ip
  if (!ipObj?.ip) return { ip: '', ipv6: '' }
  if (String(ipObj.type) === '6') return { ip: '', ipv6: String(ipObj.ip).trim() }
  return { ip: String(ipObj.ip).trim(), ipv6: '' }
}

function calculateConstructorExtraCost(
  server: UserApiServerDetail,
  plan: UserApiServerPlan,
): number {
  if (!plan.has_params || !plan.params) return 0

  const serverData = server.data ?? {}
  const planData = plan.data ?? {}
  let extra = 0

  for (const key of ['cpu', 'ram', 'disk'] as const) {
    const param = plan.params[key]
    if (!param?.cost) continue
    const paramCost = parsePlanCost(param.cost) ?? 0
    const serverRes = serverData[key]
    const planBase = planData[key]?.value ?? 0
    const serverTotal = serverRes?.total ?? serverRes?.value ?? planBase
    const units = Math.max(0, serverTotal - planBase)
    if (units > 0) extra += units * paramCost
  }

  return extra
}

function roundRate(n: number): number {
  return Math.round(n * 100) / 100
}

function ratesFromCost(
  cost: number,
  period: 'day' | 'month',
): { tariffType: string; dailyRate: number | null; monthlyRate: number | null } {
  if (period === 'month') {
    return { tariffType: 'monthly', dailyRate: null, monthlyRate: roundRate(cost) }
  }
  const dailyRate = roundRate(cost)
  return { tariffType: 'daily', dailyRate, monthlyRate: roundRate(dailyRate * 30) }
}

function resolveRatesFromTariffItem(
  price: string,
): { tariffType: string; dailyRate: number | null; monthlyRate: number | null } | null {
  const parsed = parseTariffPrice(price)
  if (parsed.amount == null || !Number.isFinite(parsed.amount)) return null

  if (parsed.period === 'day') {
    const dailyRate = roundRate(parsed.amount)
    return { tariffType: 'daily', dailyRate, monthlyRate: roundRate(dailyRate * 30) }
  }

  return {
    tariffType: 'monthly',
    dailyRate: null,
    monthlyRate: roundRate(parsed.amount),
  }
}

function resolvePlanRates(
  server: UserApiServerDetail,
  apiType: UserApiType,
  billingMode: string | null | undefined,
  planIndex?: UserApiPlanCostIndex,
  tariffByPlanId?: Map<string, UserApiTariffItem>,
): { tariffType: string; dailyRate: number | null; monthlyRate: number | null } {
  const planId = server['server-plan']?.id
  const defaultType = inferPlanPeriod(undefined, apiType, billingMode) === 'month' ? 'monthly' : 'daily'
  if (planId == null) {
    return { tariffType: defaultType, dailyRate: null, monthlyRate: null }
  }

  const planKey = String(planId)

  if (planIndex) {
    const plan = findPlanInIndex(planIndex, server)
    const baseCost = plan ? effectivePlanCost(plan) : null
    if (plan && baseCost != null) {
      const cost = baseCost + calculateConstructorExtraCost(server, plan)
      return ratesFromCost(cost, inferPlanPeriod(plan, apiType, billingMode))
    }
  }

  const tariff = tariffByPlanId?.get(planKey)
  if (tariff?.price) {
    const fromTariff = resolveRatesFromTariffItem(tariff.price)
    if (fromTariff) return fromTariff
  }

  return { tariffType: defaultType, dailyRate: null, monthlyRate: null }
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
  type: 'provider_balance_topup'
  date: string
  amount: number
  currency: string
  providerAccountId: string
  vpsId: null
  note: string
}

export function mapServerToVps(
  server: UserApiServerDetail,
  apiType: UserApiType,
  providerId: string,
  providerAccountId: string,
  planIndex?: UserApiPlanCostIndex,
  currency = 'RUB',
  tariffByPlanId?: Map<string, UserApiTariffItem>,
  billingMode?: string | null,
): MappedVps {
  const { ip, ipv6 } = extractIp(server)
  const data = server.data ?? {}
  const planName = server['server-plan']?.name ?? server.full_name ?? ''
  const datacenter = server.datacenter?.name ?? ''
  const country = (server.datacenter?.country ?? '').toUpperCase()
  const status = STATUS_MAP[String(server.status).toLowerCase()] ?? 'active'
  const name = String(server.name || '').trim()
  const host = String(server.host || '').trim()
  const traffGb = data.traff?.value ?? 0
  const bandwidthTb =
    data.traff?.for?.toLowerCase() === 'tb'
      ? traffGb
      : traffGb > 0
        ? Math.round((traffGb / 1024) * 100) / 100
        : 0
  const { tariffType, dailyRate, monthlyRate } = resolvePlanRates(
    server,
    apiType,
    billingMode,
    planIndex,
    tariffByPlanId,
  )
  const resolvedCurrency = (currency || 'RUB').trim().toUpperCase() || 'RUB'

  return {
    externalId: String(server.id),
    ip,
    dns: host || name,
    ipv6,
    additionalIps: [],
    providerId,
    providerAccountId,
    country,
    city: '',
    datacenter,
    os: String(server.template?.name || '').trim(),
    vcpu: data.cpu?.value ?? 0,
    ramGb: data.ram?.value ?? 0,
    diskGb: data.disk?.value ?? 0,
    diskType: inferDiskType(planName),
    virtualization: 'KVM',
    bandwidthTb,
    sshPort: 22,
    rootUser: 'root',
    purpose: '',
    environment: '',
    project: '',
    monitoringEnabled: false,
    backupEnabled: false,
    status,
    tariffType,
    currency: resolvedCurrency,
    dailyRate,
    monthlyRate,
    createdAt: dateToIso(server.created),
    paidUntil: dateToIso(server.end),
    notes: name ? `${name} [${apiType}-${server.id}]` : `${apiType}-${server.id}`,
  }
}

export function mapOperationToPayment(
  op: UserApiOperation,
  apiType: UserApiType,
  providerAccountId: string,
  currency = 'RUB',
): MappedPayment | null {
  if (op.type !== 1 || op.status !== 1 || op.purse !== 'real') return null
  const raw = op.summ
  const amount =
    typeof raw === 'number'
      ? raw
      : Number.parseFloat(String(raw ?? '').replace(/[^\d.-]/g, '')) || 0
  if (amount <= 0) return null
  const dateStr = op.created ? String(op.created).slice(0, 10) : new Date().toISOString().slice(0, 10)
  const label = apiType === 'vdsina' ? 'VDSina' : 'Macloud'
  return {
    externalId: String(op.id),
    type: 'provider_balance_topup',
    date: dateStr,
    amount,
    currency,
    providerAccountId,
    vpsId: null,
    note: op.comment?.trim() || `${label} #${op.id}`,
  }
}
