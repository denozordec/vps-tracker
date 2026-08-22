import { z } from 'zod'

export const CENSORCHECK_STATUSES = [
  'available',
  'redirected',
  'denied',
  'blocked',
  'timeout',
  'error',
] as const

export type CensorcheckStatus = (typeof CENSORCHECK_STATUSES)[number]

export const CENSORCHECK_CATEGORIES = ['dpi', 'geoblock', 'custom'] as const

export type CensorcheckCategory = (typeof CENSORCHECK_CATEGORIES)[number]

export const CENSORCHECK_RUN_STATUSES = ['complete', 'partial'] as const

export type CensorcheckRunStatus = (typeof CENSORCHECK_RUN_STATUSES)[number]

/** DPI-сервисы из vernette/censorcheck (pin 12c5839). */
export const CENSORCHECK_DPI_HOSTS = [
  'youtube.com',
  'redirector.googlevideo.com',
  'discord.com',
  'instagram.com',
  'facebook.com',
  'x.com',
  'linkedin.com',
  'rutracker.org',
  'digitalocean.com',
  'amnezia.org',
  'getoutline.org',
  'mailfence.com',
  'flibusta.is',
  'rezka.ag',
  'api.telegram.org',
  'play.google.com',
] as const

/** Геоблок-сервисы из vernette/censorcheck (pin 12c5839). */
export const CENSORCHECK_GEOBLOCK_HOSTS = [
  'spotify.com',
  'netflix.com',
  'patreon.com',
  'swagger.io',
  'snyk.io',
  'mongodb.com',
  'autodesk.com',
  'graylog.org',
  'redis.io',
  'copilot.microsoft.com',
] as const

const DPI_SET = new Set<string>(CENSORCHECK_DPI_HOSTS)
const GEO_SET = new Set<string>(CENSORCHECK_GEOBLOCK_HOSTS)

export function inferCensorcheckCategory(serviceKey: string): CensorcheckCategory {
  const key = serviceKey.trim().toLowerCase()
  if (DPI_SET.has(key)) return 'dpi'
  if (GEO_SET.has(key)) return 'geoblock'
  return 'custom'
}

export const censorcheckStatusSchema = z.enum(CENSORCHECK_STATUSES)
export const censorcheckCategorySchema = z.enum(CENSORCHECK_CATEGORIES)

export const censorcheckIngestResultSchema = z.object({
  service: z.string().trim().min(1).max(253),
  category: censorcheckCategorySchema.optional(),
  raw: z.record(z.unknown()).default({}),
})

export const censorcheckIngestBodySchema = z.object({
  schemaVersion: z.literal(1),
  runId: z.string().trim().min(8).max(80),
  probe: z.object({
    publicIp: z.string().trim().min(1).max(64),
  }),
  censorcheck: z
    .object({
      version: z.string().trim().max(32).optional(),
      mode: z.string().trim().max(32).optional(),
    })
    .optional(),
  launcherVersion: z.string().trim().max(32).optional(),
  results: z.array(censorcheckIngestResultSchema).min(1).max(200),
})

export type CensorcheckIngestBody = z.infer<typeof censorcheckIngestBodySchema>
export type CensorcheckIngestResult = z.infer<typeof censorcheckIngestResultSchema>

export type CensorcheckSummary = {
  total: number
  available: number
  redirected: number
  denied: number
  blocked: number
  timeout: number
  error: number
}

export function emptyCensorcheckSummary(): CensorcheckSummary {
  return {
    total: 0,
    available: 0,
    redirected: 0,
    denied: 0,
    blocked: 0,
    timeout: 0,
    error: 0,
  }
}
