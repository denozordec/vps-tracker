import { z } from 'zod'

export const IPREGION_STATUSES = [
  'ok',
  'na',
  'denied',
  'rate_limit',
  'server_error',
] as const

export type IpregionStatus = (typeof IPREGION_STATUSES)[number]

export const IPREGION_GROUPS = ['primary', 'custom', 'cdn'] as const

export type IpregionGroup = (typeof IPREGION_GROUPS)[number]

export const IPREGION_RUN_STATUSES = ['complete', 'partial'] as const

export type IpregionRunStatus = (typeof IPREGION_RUN_STATUSES)[number]

/** GeoIP-сервисы vernette/ipregion (pin 7d1c25c), display names из JSON. */
export const IPREGION_PRIMARY_SERVICES = [
  'maxmind.com',
  'rdap.db.ripe.net',
  'ipinfo.io',
  'cloudflare.com',
  'ipregistry.co',
  'ipapi.co',
  'ifconfig.co',
  'ip2location.io',
  'iplocation.com',
  'country.is',
  'geoapify.com',
  'geojs.io',
  'ipapi.is',
  'ipbase.com',
  'ipquery.io',
  'ipwho.is',
  'ip-api.com',
] as const

export const IPREGION_CUSTOM_SERVICES = [
  'google',
  'youtube',
  'twitch',
  'chatgpt',
  'netflix',
  'spotify',
  'reddit',
  'disney+',
  'gemini supported',
  'reddit (guest access)',
  'youtube premium',
  'google search captcha',
  'spotify signup',
  'disney+ access',
  'apple',
  'steam',
  'tiktok',
  'ookla speedtest',
  'jetbrains',
  'playstation',
  'microsoft',
] as const

export const IPREGION_CDN_SERVICES = [
  'cloudflare cdn',
  'youtube cdn',
  'netflix cdn',
] as const

const PRIMARY_SET = new Set<string>(IPREGION_PRIMARY_SERVICES)
const CUSTOM_SET = new Set<string>(IPREGION_CUSTOM_SERVICES)
const CDN_SET = new Set<string>(IPREGION_CDN_SERVICES)

export function inferIpregionGroup(serviceKey: string): IpregionGroup {
  const key = serviceKey.trim().toLowerCase()
  if (PRIMARY_SET.has(key)) return 'primary'
  if (CDN_SET.has(key)) return 'cdn'
  if (CUSTOM_SET.has(key)) return 'custom'
  return 'custom'
}

export const ipregionStatusSchema = z.enum(IPREGION_STATUSES)
export const ipregionGroupSchema = z.enum(IPREGION_GROUPS)

export const ipregionIngestResultSchema = z.object({
  service: z.string().trim().min(1).max(253),
  group: ipregionGroupSchema.optional(),
  ipv4: z.string().trim().max(64).nullish(),
  ipv6: z.string().trim().max(64).nullish(),
})

export const ipregionIngestBodySchema = z.object({
  schemaVersion: z.literal(1),
  runId: z.string().trim().min(8).max(80),
  probe: z.object({
    publicIp: z.string().trim().min(1).max(64),
    hoster: z.string().trim().max(160).optional(),
  }),
  ipregion: z
    .object({
      version: z.string().trim().max(32).optional(),
    })
    .optional(),
  launcherVersion: z.string().trim().max(32).optional(),
  results: z.array(ipregionIngestResultSchema).min(1).max(200),
})

export type IpregionIngestBody = z.infer<typeof ipregionIngestBodySchema>
export type IpregionIngestResult = z.infer<typeof ipregionIngestResultSchema>

export type IpregionSummary = {
  total: number
  ok: number
  na: number
  denied: number
  rate_limit: number
  server_error: number
}

export function emptyIpregionSummary(): IpregionSummary {
  return {
    total: 0,
    ok: 0,
    na: 0,
    denied: 0,
    rate_limit: 0,
    server_error: 0,
  }
}

const ISO_RE = /^[A-Z]{2}$/
const ISO_IATA_RE = /^([A-Z]{2})\s*\(([A-Z]{3})\)$/
const IATA_RE = /^[A-Z]{3}$/

export type CanonicalCountry = {
  status: IpregionStatus
  country: string | null
  iata: string | null
}

/** ISO `RU` / CDN `SE (ARN)` → ok; иначе статусы ipregion (`N/A`, `Denied`, `Rate-limit`, `Server error`). */
export function canonicalizeCountryValue(
  raw: string | null | undefined,
): CanonicalCountry {
  const value = raw?.replace(/\s+/g, ' ').trim() ?? ''
  if (!value || /^null$/i.test(value) || /^n\/a$/i.test(value)) {
    return { status: 'na', country: null, iata: null }
  }
  if (/^denied$/i.test(value)) return { status: 'denied', country: null, iata: null }
  if (/^rate[- ]?limit$/i.test(value)) return { status: 'rate_limit', country: null, iata: null }
  if (/^server error$/i.test(value)) return { status: 'server_error', country: null, iata: null }

  const upper = value.toUpperCase()
  const withIata = upper.match(ISO_IATA_RE)
  if (withIata) {
    return { status: 'ok', country: withIata[1]!, iata: withIata[2]! }
  }
  if (ISO_RE.test(upper)) {
    return { status: 'ok', country: upper, iata: null }
  }
  const iataOnly = upper.match(/^\(([A-Z]{3})\)$/)
  if (iataOnly) {
    return { status: 'ok', country: null, iata: iataOnly[1]! }
  }
  if (IATA_RE.test(upper)) {
    return { status: 'ok', country: null, iata: upper }
  }
  return { status: 'server_error', country: null, iata: null }
}

export function formatCanonicalCountry(parsed: CanonicalCountry): string | null {
  if (parsed.country && parsed.iata) return `${parsed.country} (${parsed.iata})`
  if (parsed.country) return parsed.country
  if (parsed.iata) return parsed.iata
  return null
}
