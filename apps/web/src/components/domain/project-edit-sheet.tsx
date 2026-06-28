import { FormSheetRhf } from '@/components/form-sheet-rhf'
import { FormField } from '@/components/form-field'
import { Input } from '@cfdm/ui/components/input'
import { projectSchema, type ProjectFormValues } from '@/lib/schemas'

const EMPTY: ProjectFormValues = { name: '', color: '' }

interface ProjectEditSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultValues?: ProjectFormValues
  onSubmit: (values: ProjectFormValues) => void
  submitting?: boolean
}

export function projectFormDefaults(edit?: Partial<ProjectFormValues> | null): ProjectFormValues {
  if (!edit) return { ...EMPTY }
  return { ...EMPTY, ...edit, color: edit.color ?? '' }
}

export function ProjectEditSheet({
  open,
  onOpenChange,
  defaultValues = EMPTY,
  onSubmit,
  submitting,
}: ProjectEditSheetProps) {
  const isEdit = Boolean(defaultValues.id)

  return (
    <FormSheetRhf
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? 'Редактировать проект' : 'Новый проект'}
      description="Имя будет доступно в автодополнении на форме VPS"
      schema={projectSchema as import('zod').ZodType<ProjectFormValues>}
      defaultValues={defaultValues}
      onSubmit={onSubmit}
      submitting={submitting}
    >
      {(form) => {
        const { register, formState: { errors } } = form
        return (
          <>
            <FormField label="Название" htmlFor="project-name" error={errors.name?.message} invalid={!!errors.name}>
              <Input id="project-name" aria-invalid={!!errors.name} {...register('name')} />
            </FormField>
            <FormField label="Цвет (hex)" htmlFor="project-color" description="Например #3b82f6 — для badge в списке VPS">
              <Input id="project-color" placeholder="#3b82f6" {...register('color')} />
            </FormField>
          </>
        )
      }}
    </FormSheetRhf>
  )
}
