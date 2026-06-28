import { z } from 'zod'

export const API_TYPES = ['billmanager', '4vps', 'none'] as const
export type ApiType = (typeof API_TYPES)[number]
export const apiTypeSchema = z.enum(API_TYPES).optional().default('none')

export const SYNC_API_TYPES = ['billmanager', '4vps'] as const
export type SyncApiType = (typeof SYNC_API_TYPES)[number]

export function isSyncApiType(apiType?: string | null): apiType is SyncApiType {
  const key = String(apiType || '').toLowerCase()
  return (SYNC_API_TYPES as readonly string[]).includes(key)
}

export const providerSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, 'Name is required'),
  website: z.string().optional().default(''),
  contact: z.string().optional().default(''),
  baseCurrency: z.string().optional().default(''),
  usdRate: z.string().optional().default(''),
  eurRate: z.string().optional().default(''),
  notes: z.string().optional().default(''),
  apiType: apiTypeSchema,
  apiBaseUrl: z.string().optional().default(''),
})

export type Provider = z.infer<typeof providerSchema>
