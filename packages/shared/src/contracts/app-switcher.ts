import { z } from 'zod'

export const appSwitcherIconSchema = z.enum(['server', 'cloud', 'globe', 'dashboard', 'chart'])

export const appSwitcherEntrySchema = z.object({
  id: z.string(),
  name: z.string(),
  subtitle: z.string().optional(),
  url: z.string().url('Невалидный URL'),
  icon: appSwitcherIconSchema.default('server'),
  enabled: z.boolean().optional(),
  sort: z.number().optional(),
  shortcut: z.string().optional(),
})

export const appSwitcherConfigSchema = z.object({
  menuLabel: z.string().default('Приложения'),
  apps: z.array(appSwitcherEntrySchema).min(1),
})

export type AppSwitcherEntry = z.infer<typeof appSwitcherEntrySchema>
export type AppSwitcherConfig = z.infer<typeof appSwitcherConfigSchema>
