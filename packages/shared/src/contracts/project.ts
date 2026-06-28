import { z } from 'zod'

export const projectSchema = z.object({
  name: z.string().min(1, 'Укажите название проекта').max(120),
})

export type ProjectFormValues = z.infer<typeof projectSchema>
