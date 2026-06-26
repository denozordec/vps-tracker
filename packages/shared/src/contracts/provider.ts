import { z } from 'zod'

export const providerSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, 'Name is required'),
  website: z.string().optional().default(''),
  contact: z.string().optional().default(''),
  baseCurrency: z.string().optional().default(''),
  usdRate: z.string().optional().default(''),
  eurRate: z.string().optional().default(''),
  notes: z.string().optional().default(''),
  apiType: z.string().optional().default(''),
  apiBaseUrl: z.string().optional().default(''),
})

export type Provider = z.infer<typeof providerSchema>
