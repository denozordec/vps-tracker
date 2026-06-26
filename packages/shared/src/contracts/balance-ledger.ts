import { z } from 'zod'

export const balanceLedgerSchema = z.object({
  id: z.string().optional(),
  type: z.string().min(1, 'Type is required'),
  date: z.string().min(1, 'Date is required'),
  amount: z.coerce.number(),
  currency: z.string().optional().default(''),
  direction: z.string().optional().default(''),
  providerAccountId: z.string().optional().default(''),
  vpsId: z.string().optional().default(''),
  note: z.string().optional().default(''),
})

export type BalanceLedger = z.infer<typeof balanceLedgerSchema>
