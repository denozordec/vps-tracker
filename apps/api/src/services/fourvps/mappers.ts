/**
 * 4VPS API response → vps-tracker model mappers
 */

import type { FourVpsDatacenter, FourVpsServer } from './operations.js'

const STATUS_MAP: Record<string, string> = {
  active: 'active',
  paused: 'paused',
  suspended: 'paused',
  deleted: 'archived',
}

function unixToIso(ts: number | null | undefined): string {
  if (ts == null || !Number.isFinite(ts) || ts <= 0) return ''
  return new Date(ts * 1000).toISOString().slice(0, 10)
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
  dailyRate: null
  monthlyRate: number | null
  createdAt: string
  paidUntil: string
  notes: string
}

export function mapServerToVps(
  server: FourVpsServer,
  providerId: string,
  providerAccountId: string,
  dcMap: Map<number, FourVpsDatacenter>,
): MappedVps {
  const dc = dcMap.get(server.dc)
  const datacenter = dc?.dc_name ?? String(server.dc)
  const country = (dc?.flag ?? '').toUpperCase()
  const status = STATUS_MAP[String(server.status).toLowerCase()] ?? 'active'
  const monthlyRate = Number.isFinite(server.price) ? server.price : null
  const name = String(server.name || '').trim()

  return {
    externalId: String(server.id),
    ip: String(server.ipv4 || '').trim(),
    dns: name,
    ipv6: '',
    additionalIps: [],
    providerId,
    providerAccountId,
    country,
    city: '',
    datacenter,
    os: String(server.image || '').trim(),
    vcpu: server.cpu ?? 0,
    ramGb: server.mem ?? 0,
    diskGb: server.disk ?? 0,
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
    tariffType: 'monthly',
    currency: 'RUB',
    dailyRate: null,
    monthlyRate,
    createdAt: unixToIso(server.time),
    paidUntil: unixToIso(server.expired),
    notes: name ? `${name} [4vps-${server.id}]` : `4vps-${server.id}`,
  }
}
