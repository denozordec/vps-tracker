import type { IpregionSummary } from '@cfdm/shared/contracts/ipregion'

export type IpregionResultDto = {
  id: string
  runId: string
  serviceKey: string
  serviceLabel: string
  group: string
  countryIpv4: string | null
  countryIpv6: string | null
  status: string
}

export type IpregionVpsInfo = {
  id: string
  ip: string
  dns: string
  providerId: string
  providerName: string
  country: string
  city: string
  datacenter: string
  vcpu: number
  ramGb: number
  diskGb: number
}

export type IpregionRunDto = {
  id: string
  spaceId: string
  runId: string
  probePublicIp: string
  claimedPublicIp: string | null
  matchedVpsId: string | null
  status: string
  schemaVersion: number
  launcherVersion: string | null
  ipregionVersion: string | null
  summary: IpregionSummary
  createdAt: string
  completedAt: string
  observedSourceIp: string | null
  detectedHoster?: string | null
  vps: IpregionVpsInfo | null
  results?: IpregionResultDto[]
}

export const IPREGION_STATUS_LABELS: Record<string, string> = {
  ok: 'Страна',
  na: 'N/A',
  denied: 'Отказ',
  rate_limit: 'Лимит',
  server_error: 'Ошибка',
  complete: 'Полный',
  partial: 'Частичный',
}

export const LAUNCHER_CMD = 'curl -fsSL https://vt.shnt.top/ic | bash'
export const LAUNCHER_CMD_DAILY = 'curl -fsSL https://vt.shnt.top/ic | bash -s -- --daily'
export const LAUNCHER_CMD_ROS =
  ':global vtIface "ether1"; /tool fetch url="https://vt.shnt.top/ic.rsc" dst-path=vt-ic.rsc; /import file-name=vt-ic.rsc'
export const LAUNCHER_CMD_ROS_DAILY =
  ':global vtIface "ether1"; /tool fetch url="https://vt.shnt.top/ic.rsc?daily=1" dst-path=vt-ic.rsc; /import file-name=vt-ic.rsc'

export function formatVpsResources(vcpu: number, ramGb: number, diskGb: number): string {
  return `${vcpu} vCPU / ${ramGb} GB / ${diskGb} GB`
}

export function formatCheckedAt(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleString('ru-RU')
}

export function runHosterLabel(run: IpregionRunDto): string {
  const inventory = run.vps?.providerName?.trim() ?? ''
  if (inventory) return inventory
  return run.detectedHoster?.trim() ?? ''
}

export function runSearchText(run: IpregionRunDto): string {
  const parts = [
    run.probePublicIp,
    run.claimedPublicIp ?? '',
    run.vps?.dns ?? '',
    run.vps?.providerName ?? '',
    run.detectedHoster ?? '',
    run.vps?.country ?? '',
    ...(run.results ?? []).map(
      (row) => `${row.serviceKey} ${row.serviceLabel} ${row.countryIpv4 ?? ''} ${row.countryIpv6 ?? ''}`,
    ),
  ]
  return parts.join(' ').toLowerCase()
}
