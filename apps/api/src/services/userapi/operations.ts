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
  cpu?: { value?: number; for?: string }
  ram?: { value?: number; for?: string }
  disk?: { value?: number; for?: string }
  gpu?: { value?: number; for?: string } | null
  traff?: { value?: number; for?: string }
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
  cost: number
  full_cost?: number
  period?: string
  description?: string
  active?: boolean
  enable?: boolean
  has_params?: boolean
  data?: UserApiTariffSpec | null
}

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
): UserApiTariffItem {
  const data = plan.data ?? {}
  const diskGb = data.disk?.value ?? 0
  const priceSuffix = plan.period === 'day' ? ' ₽/день' : ' ₽'
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
    price: plan.cost != null ? `${plan.cost}${priceSuffix}` : '',
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

export async function fetchServerGroups(
  baseUrl: string,
  credentials: string,
): Promise<UserApiServerGroup[]> {
  const { baseUrl: url, token } = parseCredentials(baseUrl, credentials)
  const data = await userApiRequest<UserApiServerGroup[]>(url, token, '/server-group')
  return Array.isArray(data) ? data.filter((g) => g.active !== false) : []
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

export async function fetchTariffList(
  baseUrl: string,
  credentials: string,
): Promise<UserApiTariffItem[]> {
  const groups = await fetchServerGroups(baseUrl, credentials)
  const items: UserApiTariffItem[] = []

  for (const group of groups) {
    const plans = await fetchServerPlans(baseUrl, credentials, group.id)
    const groupKey = String(group.id)
    for (const plan of plans) {
      if (plan.active === false || plan.enable === false) continue
      items.push(mapPlanToTariffItem(plan, groupKey, group.name || ''))
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
