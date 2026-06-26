import { z } from 'zod'

export const paymentSchema = z.object({
  id: z.string().optional(),
  type: z.string().min(1, 'Type is required'),
  date: z.string().min(1, 'Date is required'),
  amount: z.coerce.number(),
  currency: z.string().optional().default(''),
  providerAccountId: z.string().optional().default(''),
  vpsId: z.string().optional().default(''),
  note: z.string().optional().default(''),
})

export type Payment = z.infer<typeof paymentSchema>
