/**
 * RuVDS API v2 operations
 */

import { parseRuvdsToken } from '@cfdm/shared/utils/api-credentials'

import { createRuvdsClient, RuvdsApiError, type RuvdsClient } from './client.js'
import type {
  RuvdsBalanceResponse,
  RuvdsDatacenter,
  RuvdsOsItem,
  RuvdsPagination,
  RuvdsPayment,
  RuvdsServer,
  RuvdsTariffsResponse,
} from './types.js'

const CURRENCY_MAP: Record<number, string> = {
  1: 'RUB',
  3: 'USD',
  4: 'EUR',
}

export function ruvdsCurrencyCode(currencyId: number | undefined | null, fallback = 'RUB'): string {
  if (currencyId == null) return fallback
  return CURRENCY_MAP[currencyId] ?? fallback
}

function clientFor(baseUrl: string, credentials: string): RuvdsClient {
  return createRuvdsClient(baseUrl, parseRuvdsToken(credentials))
}

async function fetchAllPages<T>(
  client: RuvdsClient,
  path: string,
  extract: (json: Record<string, unknown>) => T[],
  query: Record<string, string | number | boolean | undefined> = {},
): Promise<T[]> {
  const items: T[] = []
  let page = 1
  let lastPage = 1

  while (page <= lastPage) {
    const json = (await client.request<Record<string, unknown>>(path, {
      query: { ...query, page, per_page: 100 },
    })) as Record<string, unknown>
    items.push(...extract(json))
    const pagination = json.pagination as RuvdsPagination | undefined
    lastPage = pagination?.last_page ?? page
    if (!pagination?.next_page) break
    page = pagination.next_page
  }

  return items
}

export interface RuvdsBalanceResult {
  balance: number
  currency: string
  enoughmoneyto: string
}

export interface RuvdsTariffItem {
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

export async function testConnection(
  baseUrl: string,
  credentials: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await fetchBalance(baseUrl, credentials)
    return { ok: true }
  } catch (err) {
    const message = err instanceof RuvdsApiError ? err.message : String(err)
    return { ok: false, error: message }
  }
}

export async function fetchBalance(
  baseUrl: string,
  credentials: string,
  fallbackCurrency = 'RUB',
): Promise<RuvdsBalanceResult> {
  const client = clientFor(baseUrl, credentials)
  const json = await client.request<RuvdsBalanceResponse>('/v2/balance')
  return {
    balance: Number(json.amount) || 0,
    currency: ruvdsCurrencyCode(json.currency, fallbackCurrency),
    enoughmoneyto: '',
  }
}

export async function fetchAllServers(baseUrl: string, credentials: string): Promise<RuvdsServer[]> {
  const client = clientFor(baseUrl, credentials)
  return fetchAllPages<RuvdsServer>(
    client,
    '/v2/servers',
    (json) => (Array.isArray(json.servers) ? (json.servers as RuvdsServer[]) : []),
    { get_paid_till: true, get_network: true },
  )
}

export async function fetchServerCost(
  baseUrl: string,
  credentials: string,
  serverId: number,
): Promise<number | null> {
  const client = clientFor(baseUrl, credentials)
  try {
    const json = await client.request<{ cost_rub?: number }>(`/v2/servers/${serverId}/cost`)
    const cost = json.cost_rub
    return cost != null && Number.isFinite(cost) ? cost : null
  } catch {
    return null
  }
}

export async function fetchAllPayments(baseUrl: string, credentials: string): Promise<RuvdsPayment[]> {
  const client = clientFor(baseUrl, credentials)
  return fetchAllPages<RuvdsPayment>(
    client,
    '/v2/payments',
    (json) => (Array.isArray(json.payments) ? (json.payments as RuvdsPayment[]) : []),
  )
}

export async function fetchTariffs(baseUrl: string, credentials: string): Promise<RuvdsTariffsResponse> {
  const client = clientFor(baseUrl, credentials)
  return client.request<RuvdsTariffsResponse>('/v2/tariffs')
}

export async function fetchDatacenters(baseUrl: string, credentials: string): Promise<RuvdsDatacenter[]> {
  const client = clientFor(baseUrl, credentials)
  const json = await client.request<{ datacenters?: RuvdsDatacenter[] }>('/v2/datacenters')
  return Array.isArray(json.datacenters) ? json.datacenters : []
}

export async function fetchOsList(baseUrl: string, credentials: string): Promise<RuvdsOsItem[]> {
  const client = clientFor(baseUrl, credentials)
  const json = await client.request<{ os?: RuvdsOsItem[] }>('/v2/os')
  return Array.isArray(json.os) ? json.os : []
}

export async function fetchTariffList(
  baseUrl: string,
  credentials: string,
): Promise<RuvdsTariffItem[]> {
  const [tariffs, datacenters] = await Promise.all([
    fetchTariffs(baseUrl, credentials),
    fetchDatacenters(baseUrl, credentials).catch(() => [] as RuvdsDatacenter[]),
  ])

  const dc = datacenters[0]
  const dcKey = dc ? String(dc.id) : ''
  const dcName = dc?.name ?? 'RuVDS'

  const items: RuvdsTariffItem[] = []
  for (const t of tariffs.vps ?? []) {
    if (t.is_active === false) continue
    const cpuPrice = t.cpu ?? 0
    const ramPrice = t.ram ?? 0
    const sampleCpu = 2
    const sampleRam = 2
    const sampleDisk = 40
    const drivePrice = tariffs.drive?.find((d) => d.is_active !== false)?.price ?? 5.5
    const monthly = Math.round((cpuPrice * sampleCpu + ramPrice * sampleRam + drivePrice * sampleDisk) * 100) / 100
    items.push({
      externalId: String(t.id),
      datacenterKey: dcKey,
      datacenterName: dcName,
      name: t.name || `Tariff ${t.id}`,
      desc: `CPU ${cpuPrice} RUB/core, RAM ${ramPrice} RUB/GB`,
      vcpu: sampleCpu,
      ramGb: sampleRam,
      diskGb: sampleDisk,
      diskType: 'SSD',
      virtualization: 'KVM',
      channel: '',
      location: dcName,
      country: (dc?.country ?? 'RU').toUpperCase(),
      cpuModel: '',
      orderAvailable: true,
      price: monthly > 0 ? `${monthly} RUB/mo` : '',
    })
  }
  return items
}

const COST_CONCURRENCY = 4

export async function enrichServersWithCost(
  baseUrl: string,
  credentials: string,
  servers: RuvdsServer[],
): Promise<Map<number, number>> {
  const costById = new Map<number, number>()
  const ids = servers.map((s) => s.virtual_server_id).filter((id) => id > 0)
  if (ids.length === 0) return costById

  for (let i = 0; i < ids.length; i += COST_CONCURRENCY) {
    const batch = ids.slice(i, i + COST_CONCURRENCY)
    const results = await Promise.all(
      batch.map(async (id) => {
        const cost = await fetchServerCost(baseUrl, credentials, id)
        return { id, cost }
      }),
    )
    for (const { id, cost } of results) {
      if (cost != null) costById.set(id, cost)
    }
  }
  return costById
}
