import { z } from 'zod'

export const providerAccountSchema = z.object({
  id: z.string().optional(),
  providerId: z.string().min(1, 'Provider is required'),
  name: z.string().min(1, 'Name is required'),
  panelUrl: z.string().optional().default(''),
  currency: z.string().optional().default(''),
  billingMode: z.string().optional().default(''),
  notes: z.string().optional().default(''),
  apiCredentials: z.string().optional().default(''),
  balanceAlertBelow: z.union([z.number(), z.null()]).optional(),
})

export type ProviderAccount = z.infer<typeof providerAccountSchema>
