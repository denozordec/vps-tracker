import { z } from 'zod'

export const billingModeSchema = z.enum(['daily', 'monthly'])

export const providerAccountInputSchema = z.object({
  id: z.string().optional(),
  providerId: z.string().min(1, 'Provider is required'),
  name: z.string().min(1, 'Name is required'),
  panelUrl: z.string().optional().default(''),
  currency: z.string().optional().default(''),
  billingMode: billingModeSchema.optional().default('monthly'),
  notes: z.string().optional().default(''),
  apiCredentials: z.string().optional().default(''),
  balanceAlertBelow: z.union([z.number(), z.null()]).optional(),
})

export const providerAccountPublicSchema = providerAccountInputSchema
  .omit({ apiCredentials: true })
  .extend({
    apiCredentialsSet: z.boolean().optional(),
    apiLogin: z.string().optional(),
  })

/** @deprecated Используйте providerAccountInputSchema */
export const providerAccountSchema = providerAccountInputSchema

export type ProviderAccountInput = z.infer<typeof providerAccountInputSchema>
export type ProviderAccountPublic = z.infer<typeof providerAccountPublicSchema>
export type ProviderAccount = ProviderAccountInput
