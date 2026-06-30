import { z } from 'zod'

export const cfdmBindingSyncItemSchema = z.object({
  bindingId: z.number().int().positive(),
  serviceId: z.number().int().positive(),
  serviceName: z.string().min(1),
  serviceSlug: z.string().min(1),
  fqdn: z.string().min(1),
  zoneName: z.string().min(1),
  hostname: z.string(),
  ips: z.array(z.string()),
  deleted: z.boolean().optional(),
})

export const cfdmSyncBindingsBodySchema = z.object({
  bindings: z.array(cfdmBindingSyncItemSchema).min(1),
})

export type CfdmBindingSyncItem = z.infer<typeof cfdmBindingSyncItemSchema>
export type CfdmSyncBindingsBody = z.infer<typeof cfdmSyncBindingsBodySchema>

export const vpsTrackerEventSchema = z.object({
  event: z.enum(['vps_down', 'vps_up']),
  vps: z.array(
    z.object({
      id: z.string().min(1),
      ip: z.string().optional(),
      label: z.string().optional(),
    }),
  ),
  timestamp: z.string().datetime().optional(),
})

export type VpsTrackerEvent = z.infer<typeof vpsTrackerEventSchema>
