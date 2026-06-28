import { z } from 'zod'

export const API_TYPES = ['billmanager', '4vps', 'macloud', 'vdsina', 'none'] as const
export type ApiType = (typeof API_TYPES)[number]
export const apiTypeSchema = z.enum(API_TYPES).optional().default('none')

export const SYNC_API_TYPES = ['billmanager', '4vps', 'macloud', 'vdsina'] as const
export type SyncApiType = (typeof SYNC_API_TYPES)[number]

export const USER_API_TYPES = ['macloud', 'vdsina'] as const
export type UserApiType = (typeof USER_API_TYPES)[number]

export const USER_API_DEFAULT_BASE_URL: Record<UserApiType, string> = {
  macloud: 'https://userapi.macloud.ru/v1',
  vdsina: 'https://userapi.vdsina.com/v1',
}

export function isUserApiType(apiType?: string | null): apiType is UserApiType {
  const key = String(apiType || '').toLowerCase()
  return (USER_API_TYPES as readonly string[]).includes(key)
}

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
