/**
 * Macloud / VDSina UserAPI operations
 */

import { parseUserApiToken } from '@cfdm/shared/utils/api-credentials'

import { userApiRequest } from './client.js'

export type ServiceStatus = 'new' | 'active' | 'block' | 'notpaid' | 'deleted'

export interface UserApiDatacenter {
  id: number
  name: string
  country: string
  active?: boolean
}

export interface UserApiTariffSpec {
  cpu?: { value?: number; total?: number; for?: string }
  ram?: { value?: number; total?: number; for?: string }
  disk?: { value?: number; total?: number; for?: string }
  gpu?: { value?: number; for?: string } | null
  traff?: { value?: number; for?: string }
}

export interface UserApiPlanParamCost {
  cost?: number | string
  min?: number
  max?: number
}

export interface UserApiPlanParams {
  cpu?: UserApiPlanParamCost
  ram?: UserApiPlanParamCost
  disk?: UserApiPlanParamCost
  ip4?: UserApiPlanParamCost
}

export interface UserApiServerListItem {
  id: number
  name: string
  full_name?: string
  created?: string
  updated?: string
  end?: string
  status: ServiceStatus
  status_text?: string
  ip?: { id?: number; ip?: string; type?: string } | null
  'server-plan'?: { id?: number; name?: string }
  'server-group'?: { id?: number; name?: string }
  template?: { id?: number; name?: string }
  datacenter?: UserApiDatacenter | null
}

export interface UserApiServerDetail extends UserApiServerListItem {
  host?: string
  data?: UserApiTariffSpec | null
  autoprolong?: boolean
  bandwidth?: { current_month?: number; last_month?: number }
}

export interface UserApiServerGroup {
  id: number
  name: string
  active?: boolean
  description?: string
}

export interface UserApiServerPlan {
  id: number
  name: string
  cost: number | string
  full_cost?: number | string
  period?: string
  description?: string
  active?: boolean
  enable?: boolean
  has_params?: boolean
  params?: UserApiPlanParams | null
  data?: UserApiTariffSpec | null
  'server-group'?: number
}

export type UserApiPlanCostIndex = Map<string, UserApiServerPlan>

export interface UserApiOperation {
  id: number
  purse?: 'real' | 'bonus' | 'partner'
  type?: -1 | 1
  status?: 0 | 1
  summ?: string | number
  created?: string
  comment?: string
}

export interface UserApiAccountInfo {
  account?: { id?: number; name?: string }
  created?: string
  forecast?: string | null
}

export interface UserApiBalanceInfo {
  real?: string | number
  bonus?: string | number
  partner?: string | number
}

export interface UserApiBalanceResult {
  balance: number
  currency: string
  enoughmoneyto: string
}

export interface UserApiTariffItem {
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

function parseCredentials(baseUrl: string, credentials: string) {
  const url = baseUrl.trim()
  const token = parseUserApiToken(credentials)
  if (!url || !token) {
    throw new Error('API URL and credentials are required')
  }
  return { baseUrl: url, token }
}

function parseBalanceAmount(raw: string | number | undefined): number {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : 0
  const n = Number.parseFloat(String(raw ?? '').replace(/[^\d.-]/g, ''))
  return Number.isFinite(n) ? n : 0
}

/** Парсит cost/full_cost тарифного плана UserAPI (число или строка). */
export function parsePlanCost(raw: string | number | undefined | null): number | null {
  if (raw == null || raw === '') return null
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null
  const n = Number.parseFloat(String(raw).replace(/[^\d.-]/g, ''))
  return Number.isFinite(n) ? n : null
}

/** Ключ индекса тарифов: группа + plan id (ID плана уникален в рамках группы). */
export function planIndexKey(groupId: number | string, planId: number | string): string {
  return `${groupId}:${planId}`
}

/**
 * Эффективная цена плана: cost со скидкой, при 0 — full_cost.
 * UserAPI может вернуть cost=0 при 100% скидке, а реальную ставку — в full_cost.
 */
export function effectivePlanCost(plan: UserApiServerPlan): number | null {
  const discounted = parsePlanCost(plan.cost)
  const full = parsePlanCost(plan.full_cost)
  if (discounted != null && discounted > 0) return discounted
  if (full != null && full > 0) return full
  return discounted ?? full
}

export function findPlanInIndex(
  planIndex: UserApiPlanCostIndex,
  server: UserApiServerDetail,
): UserApiServerPlan | undefined {
  const planId = server['server-plan']?.id
  if (planId == null) return undefined

  const planKey = String(planId)
  const groupId = server['server-group']?.id

  if (groupId != null) {
    const scoped = planIndex.get(planIndexKey(groupId, planKey))
    if (scoped) return scoped
  }

  const direct = planIndex.get(planKey)
  if (direct) return direct

  const planName = server['server-plan']?.name?.trim().toLowerCase()
  if (!planName) return undefined

  for (const [key, plan] of planIndex) {
    if (groupId != null && key.includes(':') && !key.startsWith(`${groupId}:`)) continue
    if (plan.name?.trim().toLowerCase() === planName) return plan
  }

  return undefined
}

export function normalizePlanPeriod(period?: string): 'day' | 'month' {
  const p = (period || 'day').toLowerCase()
  if (p === 'month' || p === 'monthly') return 'month'
  return 'day'
}

/** Формат цены для active_tariffs.price — понятен parseTariffPrice. */
export function formatUserApiTariffPrice(
  cost: number,
  period: string | undefined,
  currency: string,
): string {
  const cur = (currency || 'RUB').trim().toUpperCase()
  if (normalizePlanPeriod(period) === 'day') {
    return `${cost} ${cur}/day`
  }
  return `${cost} ${cur}`
}

function inferDiskType(name: string): string {
  const upper = name.toUpperCase()
  if (upper.includes('NVME')) return 'NVMe'
  if (upper.includes('SSD')) return 'SSD'
  if (upper.includes('HDD')) return 'HDD'
  return 'NVMe'
}

function mapPlanToTariffItem(
  plan: UserApiServerPlan,
  groupId: string,
  groupName: string,
  currency: string,
): UserApiTariffItem {
  const data = plan.data ?? {}
  const diskGb = data.disk?.value ?? 0
  const cost = effectivePlanCost(plan)
  const descParts = [plan.description || '']
  if (plan.has_params) descParts.push('конструктор')
  return {
    externalId: String(plan.id),
    datacenterKey: groupId,
    datacenterName: groupName,
    name: plan.name || '',
    desc: descParts.filter(Boolean).join('; '),
    vcpu: data.cpu?.value ?? 0,
    ramGb: data.ram?.value ?? 0,
    diskGb: typeof diskGb === 'number' ? diskGb : 0,
    diskType: inferDiskType(plan.name || ''),
    virtualization: 'KVM',
    channel: '',
    location: groupName,
    country: '',
    cpuModel: '',
    orderAvailable: Boolean(plan.active && plan.enable),
    price: cost != null ? formatUserApiTariffPrice(cost, plan.period, currency) : '',
  }
}

function normalizePlanInIndex(plan: UserApiServerPlan, groupId: number): UserApiServerPlan {
  const cost = effectivePlanCost(plan)
  return {
    ...plan,
    'server-group': plan['server-group'] ?? groupId,
    cost: cost ?? plan.cost,
    period: normalizePlanPeriod(plan.period) === 'month' ? 'month' : 'day',
  }
}

/** Дополняет карту тарифов планами из индекса (в т.ч. неактивными / снятыми с заказа). */
export function augmentTariffMapFromPlanIndex(
  planIndex: UserApiPlanCostIndex,
  currency: string,
  target: Map<string, UserApiTariffItem>,
): void {
  for (const [key, plan] of planIndex) {
    if (!key.includes(':')) continue
    const planId = key.split(':')[1]
    if (!planId || target.has(planId)) continue
    const cost = effectivePlanCost(plan)
    if (cost == null || cost <= 0) continue
    const groupId = key.split(':')[0] ?? ''
    target.set(planId, mapPlanToTariffItem(plan, groupId, '', currency))
  }
}

export async function fetchAccount(baseUrl: string, credentials: string): Promise<UserApiAccountInfo> {
  const { baseUrl: url, token } = parseCredentials(baseUrl, credentials)
  const data = await userApiRequest<UserApiAccountInfo>(url, token, '/account')
  return data ?? {}
}

export async function fetchBalance(
  baseUrl: string,
  credentials: string,
  fallbackCurrency = 'RUB',
): Promise<UserApiBalanceResult> {
  const { baseUrl: url, token } = parseCredentials(baseUrl, credentials)
  const [balanceData, accountData] = await Promise.all([
    userApiRequest<UserApiBalanceInfo>(url, token, '/account.balance'),
    fetchAccount(url, token).catch(() => ({} as UserApiAccountInfo)),
  ])
  return {
    balance: parseBalanceAmount(balanceData?.real),
    currency: fallbackCurrency || 'RUB',
    enoughmoneyto: accountData.forecast ? String(accountData.forecast).slice(0, 10) : '',
  }
}

export async function fetchServers(
  baseUrl: string,
  credentials: string,
): Promise<UserApiServerListItem[]> {
  const { baseUrl: url, token } = parseCredentials(baseUrl, credentials)
  const data = await userApiRequest<UserApiServerListItem[]>(url, token, '/server')
  return Array.isArray(data) ? data : []
}

export async function fetchServerDetail(
  baseUrl: string,
  credentials: string,
  serverId: number,
): Promise<UserApiServerDetail | null> {
  const { baseUrl: url, token } = parseCredentials(baseUrl, credentials)
  const data = await userApiRequest<UserApiServerDetail>(url, token, `/server/${serverId}`)
  return data ?? null
}

export async function fetchServersWithDetails(
  baseUrl: string,
  credentials: string,
  concurrency = 10,
): Promise<UserApiServerDetail[]> {
  const list = await fetchServers(baseUrl, credentials)
  const results: UserApiServerDetail[] = []

  for (let i = 0; i < list.length; i += concurrency) {
    const batch = list.slice(i, i + concurrency)
    const details = await Promise.all(
      batch.map(async (item) => {
        try {
          const detail = await fetchServerDetail(baseUrl, credentials, item.id)
          return detail ?? item
        } catch {
          return item
        }
      }),
    )
    results.push(...details)
  }

  return results
}

export async function fetchDatacenters(
  baseUrl: string,
  credentials: string,
): Promise<Map<number, UserApiDatacenter>> {
  const { baseUrl: url, token } = parseCredentials(baseUrl, credentials)
  const data = await userApiRequest<UserApiDatacenter[]>(url, token, '/datacenter')
  const map = new Map<number, UserApiDatacenter>()
  for (const dc of Array.isArray(data) ? data : []) {
    if (dc?.id != null) map.set(dc.id, dc)
  }
  return map
}

async function fetchAllServerGroups(
  baseUrl: string,
  credentials: string,
): Promise<UserApiServerGroup[]> {
  const { baseUrl: url, token } = parseCredentials(baseUrl, credentials)
  const data = await userApiRequest<UserApiServerGroup[]>(url, token, '/server-group')
  return Array.isArray(data) ? data : []
}

export async function fetchServerGroups(
  baseUrl: string,
  credentials: string,
): Promise<UserApiServerGroup[]> {
  const groups = await fetchAllServerGroups(baseUrl, credentials)
  return groups.filter((g) => g.active !== false)
}

export async function fetchServerPlans(
  baseUrl: string,
  credentials: string,
  groupId: number,
): Promise<UserApiServerPlan[]> {
  const { baseUrl: url, token } = parseCredentials(baseUrl, credentials)
  const data = await userApiRequest<UserApiServerPlan[]>(url, token, `/server-plan/${groupId}`)
  return Array.isArray(data) ? data : []
}

export async function fetchPlanCostIndex(
  baseUrl: string,
  credentials: string,
): Promise<UserApiPlanCostIndex> {
  const groups = await fetchAllServerGroups(baseUrl, credentials)
  const index: UserApiPlanCostIndex = new Map()

  for (const group of groups) {
    const plans = await fetchServerPlans(baseUrl, credentials, group.id)
    for (const plan of plans) {
      if (plan?.id == null) continue
      const normalized = normalizePlanInIndex(plan, group.id)
      const groupKey = String(plan['server-group'] ?? group.id)
      index.set(planIndexKey(groupKey, plan.id), normalized)
      index.set(String(plan.id), normalized)
    }
  }

  return index
}

export async function fetchTariffList(
  baseUrl: string,
  credentials: string,
  currency = 'RUB',
): Promise<UserApiTariffItem[]> {
  const groups = await fetchServerGroups(baseUrl, credentials)
  const items: UserApiTariffItem[] = []

  for (const group of groups) {
    const plans = await fetchServerPlans(baseUrl, credentials, group.id)
    const groupKey = String(group.id)
    for (const plan of plans) {
      if (plan.active === false || plan.enable === false) continue
      items.push(mapPlanToTariffItem(plan, groupKey, group.name || '', currency))
    }
  }

  return items
}

export async function fetchOperations(
  baseUrl: string,
  credentials: string,
  fromDate?: string,
): Promise<UserApiOperation[]> {
  const { baseUrl: url, token } = parseCredentials(baseUrl, credentials)
  const from =
    fromDate ||
    (() => {
      const d = new Date()
      d.setDate(d.getDate() - 365)
      return d.toISOString().slice(0, 10)
    })()
  const data = await userApiRequest<UserApiOperation[]>(url, token, '/operation', {
    query: { from },
  })
  return Array.isArray(data) ? data : []
}

export async function testConnection(
  baseUrl: string,
  credentials: string,
): Promise<{ ok: boolean; error?: string; vdsCount?: number; balance?: number }> {
  if (!baseUrl?.trim() || !credentials?.trim()) {
    return { ok: false, error: 'Укажите URL и учётные данные' }
  }
  try {
    const [balanceInfo, servers] = await Promise.all([
      fetchBalance(baseUrl, credentials),
      fetchServers(baseUrl, credentials),
    ])
    return { ok: true, vdsCount: servers.length, balance: balanceInfo.balance }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Ошибка подключения'
    return { ok: false, error: message }
  }
}
