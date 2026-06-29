import { z } from 'zod'

export const serverProjectSchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string().nullable().optional(),
  sortOrder: z.number().optional(),
  notes: z.string().nullable().optional(),
  createdAt: z.string().optional(),
})

export type ServerProject = z.infer<typeof serverProjectSchema>

export const projectFormSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, 'Укажите название проекта').max(120),
  color: z.string().optional().default(''),
  notes: z.string().optional().default(''),
})

export type ProjectFormValues = z.infer<typeof projectFormSchema>

/** @deprecated use projectFormSchema */
export const projectSchema = projectFormSchema.pick({ name: true })
