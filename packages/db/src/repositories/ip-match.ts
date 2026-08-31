export function normalizeIp(ip: string): string {
  return ip.trim().toLowerCase().split('%')[0] ?? ''
}

export function isIpLiteral(value: string): boolean {
  const v = value.trim()
  if (!v) return false
  if (/^(?:\d{1,3}\.){3}\d{1,3}$/.test(v)) {
    return v.split('.').every((p) => {
      const n = Number(p)
      return Number.isInteger(n) && n >= 0 && n <= 255
    })
  }
  return v.includes(':') && !v.includes(' ')
}

type VpsIpFields = {
  id: string
  ip?: string | null
  ipv6?: string | null
  additionalIps?: string[]
}

export function collectVpsIps(vps: {
  ip?: string | null
  ipv6?: string | null
  additionalIps?: string[]
}): string[] {
  const ips: string[] = []
  if (vps.ip?.trim()) ips.push(normalizeIp(vps.ip))
  if (vps.ipv6?.trim()) ips.push(normalizeIp(vps.ipv6))
  for (const raw of vps.additionalIps ?? []) {
    if (raw?.trim()) ips.push(normalizeIp(raw))
  }
  return ips
}

export function findVpsIdByIps<T extends VpsIpFields>(allVps: T[], ips: string[]): string | null {
  const ids = findVpsIdsByIps(allVps, ips)
  return ids.length === 1 ? ids[0]! : null
}

/**
 * Все VPS, у которых IP из списка однозначен (этот IP есть ровно у одного сервера).
 * IP, висящий сразу на двух VPS, пропускается.
 */
export function findVpsIdsByIps<T extends VpsIpFields>(allVps: T[], ips: string[]): string[] {
  const normalized = [...new Set(ips.map(normalizeIp).filter((ip) => ip && isIpLiteral(ip)))]
  if (normalized.length === 0) return []

  const result = new Set<string>()
  for (const ip of normalized) {
    const matches = allVps.filter((v) => collectVpsIps(v).includes(ip))
    if (matches.length === 1) result.add(matches[0]!.id)
  }
  return [...result]
}

function ipv4Octets(ip: string): number[] | null {
  const parts = ip.split('.')
  if (parts.length !== 4) return null
  const nums = parts.map((p) => Number(p))
  if (nums.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return null
  return nums
}

export function isPrivateOrLoopbackIp(ip: string): boolean {
  const value = normalizeIp(ip)
  if (!value) return true
  const octets = ipv4Octets(value)
  if (octets) {
    const [a, b] = octets
    if (a === 0 || a === 10 || a === 127) return true
    if (a === 169 && b === 254) return true
    if (a === 172 && b !== undefined && b >= 16 && b <= 31) return true
    if (a === 192 && b === 168) return true
    return false
  }
  if (value.includes(':')) {
    if (value === '::' || value === '::1') return true
    if (value.startsWith('fe80:')) return true
    if (value.startsWith('fc') || value.startsWith('fd')) return true
    return false
  }
  return true
}
