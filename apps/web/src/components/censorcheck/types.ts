import type { CensorcheckSummary } from '@cfdm/shared/contracts/censorcheck'

export type CensorcheckResultDto = {
  id: string
  runId: string
  serviceKey: string
  serviceLabel: string
  category: string
  status: string
  httpStatus: number | null
  detail: string | null
}

export type CensorcheckVpsInfo = {
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

export type CensorcheckRunDto = {
  id: string
  spaceId: string
  runId: string
  probePublicIp: string
  claimedPublicIp: string | null
  matchedVpsId: string | null
  status: string
  schemaVersion: number
  launcherVersion: string | null
  censorcheckVersion: string | null
  summary: CensorcheckSummary
  createdAt: string
  completedAt: string
  observedSourceIp: string | null
  detectedHoster?: string | null
  vps: CensorcheckVpsInfo | null
  results?: CensorcheckResultDto[]
}

export const CENSORCHECK_STATUS_LABELS: Record<string, string> = {
  available: 'Доступен',
  redirected: 'Редирект',
  denied: 'Отказ',
  blocked: 'Заблокирован',
  timeout: 'Таймаут',
  error: 'Ошибка',
  complete: 'Полный',
  partial: 'Частичный',
}

export const LAUNCHER_CMD = 'curl -fsSL https://vt.shnt.top/cc | bash'
export const LAUNCHER_CMD_DAILY = 'curl -fsSL https://vt.shnt.top/cc | bash -s -- --daily'
export const LAUNCHER_CMD_ROS =
  '/tool fetch url="https://vt.shnt.top/cc.rsc" dst-path=vt-cc.rsc; /import file-name=vt-cc.rsc'
export const LAUNCHER_CMD_ROS_DAILY =
  '/tool fetch url="https://vt.shnt.top/cc.rsc?daily=1" dst-path=vt-cc.rsc; /import file-name=vt-cc.rsc'

export function formatVpsResources(vcpu: number, ramGb: number, diskGb: number): string {
  return `${vcpu} vCPU / ${ramGb} GB / ${diskGb} GB`
}

export function formatCheckedAt(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleString('ru-RU')
}

export function runHosterLabel(run: CensorcheckRunDto): string {
  const inventory = run.vps?.providerName?.trim() ?? ''
  if (inventory) return inventory
  return run.detectedHoster?.trim() ?? ''
}

export function runSearchText(run: CensorcheckRunDto): string {
  const parts = [
    run.probePublicIp,
    run.claimedPublicIp ?? '',
    run.vps?.dns ?? '',
    run.vps?.providerName ?? '',
    run.detectedHoster ?? '',
    run.vps?.country ?? '',
    ...(run.results ?? []).map((row) => `${row.serviceKey} ${row.serviceLabel}`),
  ]
  return parts.join(' ').toLowerCase()
}
