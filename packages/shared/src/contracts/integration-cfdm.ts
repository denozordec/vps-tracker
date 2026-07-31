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
  /** CNAME-цель (FQDN), если binding — CNAME; для матчинга по dns / цепочке. */
  cnameTarget: z.string().optional(),
  deleted: z.boolean().optional(),
})

export const cfdmSyncBindingsBodySchema = z.object({
  bindings: z.array(cfdmBindingSyncItemSchema),
  /** Полная пересинхронизация: удалить CFDM-домены, которых нет в payload. */
  fullSync: z.boolean().optional(),
}).refine((data) => data.fullSync === true || data.bindings.length >= 1, {
  message: 'bindings обязателен, если fullSync не задан',
  path: ['bindings'],
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
