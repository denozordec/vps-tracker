/**
 * 4VPS.SU API operations
 */

import { parseFourVpsCredentials } from '@cfdm/shared/utils/api-credentials'

import { fourvpsRequest } from './client.js'
import { countryFromFourVpsFlag, parseFourVpsDcLocation } from './location.js'

export interface FourVpsServer {
  id: number
  name: string
  price: number
  dc: number
  image: string
  mem: number
  cpu: number
  disk: number
  ipv4: string
  status: string
  tname: string
  time: number
  expired: number
  autoprolong?: number
}

export interface FourVpsDatacenter {
  id: number
  dc_name: string
  flag: string
  cpu_name?: string
  t_name?: string
}

export interface FourVpsTariffPreset {
  id: number
  name: string
  nameFull?: string
  cpu_number: number
  ram_mib: number
  rom?: number
  commentParsed?: { price?: string | number; eth?: string }
  disks?: { size_mib?: number; tags?: { name?: string }[] }[]
}

export interface FourVpsTariffItem {
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

export interface FourVpsBalanceInfo {
  balance: number
  currency: string
}

function parseCredentials(baseUrl: string, credentials: string) {
  const url = baseUrl.trim()
  const { panelId, apiKey } = parseFourVpsCredentials(credentials)
  if (!url || !apiKey) {
    throw new Error('API URL and credentials are required')
  }
  return { baseUrl: url, panelId, apiKey }
}

export async function fetchUserBalance(
  baseUrl: string,
  credentials: string,
  fallbackCurrency = 'RUB',
): Promise<FourVpsBalanceInfo> {
  const { baseUrl: url, apiKey } = parseCredentials(baseUrl, credentials)
  const data = await fourvpsRequest<{ userBalance?: number }>(url, apiKey, '/userBalance')
  const raw = data?.userBalance
  const balance = typeof raw === 'number' ? raw : Number.parseFloat(String(raw ?? ''))
  return {
    balance: Number.isFinite(balance) ? balance : 0,
    currency: fallbackCurrency || 'RUB',
  }
}

export async function fetchMyServers(baseUrl: string, credentials: string): Promise<FourVpsServer[]> {
  const { baseUrl: url, apiKey } = parseCredentials(baseUrl, credentials)
  const data = await fourvpsRequest<{ serverlist?: FourVpsServer[] }>(url, apiKey, '/myservers')
  return Array.isArray(data?.serverlist) ? data.serverlist : []
}

export async function fetchDcList(
  baseUrl: string,
  credentials: string,
): Promise<Map<number, FourVpsDatacenter>> {
  const { baseUrl: url, panelId, apiKey } = parseCredentials(baseUrl, credentials)
  if (panelId == null) return new Map()

  const data = await fourvpsRequest<{ dcList?: Record<string, FourVpsDatacenter> }>(
    url,
    apiKey,
    '/getDcList',
    { panelId },
  )
  const map = new Map<number, FourVpsDatacenter>()
  const dcList = data?.dcList ?? {}
  for (const [key, dc] of Object.entries(dcList)) {
    const id = dc?.id ?? Number.parseInt(key, 10)
    if (Number.isFinite(id)) {
      map.set(id, { ...dc, id })
    }
  }
  return map
}

function mapPresetToTariffItem(
  preset: FourVpsTariffPreset,
  dcId: string,
  dcName: string,
  country: string,
  cpuModel: string,
  location = dcName,
): FourVpsTariffItem {
  const diskMib = preset.disks?.[0]?.size_mib ?? (preset.rom ?? 0)
  const diskGb = diskMib > 0 ? Math.round(diskMib / 1024) : preset.rom ?? 0
  const diskTag = preset.disks?.[0]?.tags?.find((t) => t.name)?.name ?? 'nvme'
  const priceRaw = preset.commentParsed?.price
  const price = priceRaw != null ? String(priceRaw) : ''

  return {
    externalId: String(preset.id),
    datacenterKey: dcId,
    datacenterName: dcName,
    name: preset.nameFull || preset.name || '',
    desc: preset.commentParsed?.eth ? `Канал: ${preset.commentParsed.eth}` : '',
    vcpu: preset.cpu_number ?? 0,
    ramGb: preset.ram_mib ? Math.round((preset.ram_mib / 1024) * 10) / 10 : 0,
    diskGb: typeof diskGb === 'number' ? diskGb : 0,
    diskType: diskTag.toUpperCase(),
    virtualization: 'KVM',
    channel: preset.commentParsed?.eth ?? '',
    location,
    country,
    cpuModel,
    orderAvailable: true,
    price,
  }
}

export async function fetchTarifList(
  baseUrl: string,
  credentials: string,
): Promise<FourVpsTariffItem[]> {
  const { baseUrl: url, panelId, apiKey } = parseCredentials(baseUrl, credentials)
  if (panelId == null) return []

  const [tarifData, dcMap] = await Promise.all([
    fourvpsRequest<{
      tarifList?: Record<
        string,
        {
          clusterInfo?: {
            id?: number
            dc_name?: string
            flag?: string
            cpu_name?: string
            presets?: number[]
          }
          presets?: Record<string, FourVpsTariffPreset>
        }
      >
    }>(url, apiKey, '/getTarifList', { panelId }),
    fetchDcList(baseUrl, credentials),
  ])

  const items: FourVpsTariffItem[] = []
  const tarifList = tarifData?.tarifList ?? {}

  for (const [dcKey, cluster] of Object.entries(tarifList)) {
    const clusterInfo = cluster.clusterInfo ?? {}
    const dcId = String(clusterInfo.id ?? dcKey)
    const dcFromList = dcMap.get(Number(clusterInfo.id ?? dcKey))
    const dcName = clusterInfo.dc_name ?? dcFromList?.dc_name ?? ''
    const flag = clusterInfo.flag ?? dcFromList?.flag ?? ''
    const { country: parsedCountry, city } = parseFourVpsDcLocation(dcName, flag)
    const country = parsedCountry || countryFromFourVpsFlag(flag)
    const location = city || dcName
    const cpuModel = clusterInfo.cpu_name ?? dcFromList?.cpu_name ?? ''
    const presets = cluster.presets ?? {}

    for (const preset of Object.values(presets)) {
      if (!preset?.id) continue
      items.push(mapPresetToTariffItem(preset, dcId, dcName, country, cpuModel, location))
    }
  }

  return items
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
      fetchUserBalance(baseUrl, credentials),
      fetchMyServers(baseUrl, credentials),
    ])
    return { ok: true, vdsCount: servers.length, balance: balanceInfo.balance }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Ошибка подключения'
    return { ok: false, error: message }
  }
}
