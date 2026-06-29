import { Controller } from 'react-hook-form'

import { FormSheetRhf } from '@/components/form-sheet-rhf'
import { FormField } from '@/components/form-field'
import { Input } from '@cfdm/ui/components/input'
import { Textarea } from '@cfdm/ui/components/textarea'
import { ColorPicker } from '@/components/reui/color-picker'
import { projectSchema, type ProjectFormValues } from '@/lib/schemas'

const EMPTY: ProjectFormValues = { name: '', color: '', notes: '' }

interface ProjectEditSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultValues?: ProjectFormValues
  onSubmit: (values: ProjectFormValues) => void
  submitting?: boolean
}

export function projectFormDefaults(edit?: Partial<ProjectFormValues> | null): ProjectFormValues {
  if (!edit) return { ...EMPTY }
  return { ...EMPTY, ...edit, color: edit.color ?? '', notes: edit.notes ?? '' }
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
        const {
          register,
          control,
          formState: { errors },
        } = form
        return (
          <>
            <FormField label="Название" htmlFor="project-name" error={errors.name?.message} invalid={!!errors.name}>
              <Input id="project-name" aria-invalid={!!errors.name} {...register('name')} />
            </FormField>
            <FormField
              label="Цвет (hex)"
              htmlFor="project-color"
              description="Например #3b82f6 — для badge в списке VPS"
              error={errors.color?.message}
              invalid={!!errors.color}
            >
              <Controller
                control={control}
                name="color"
                render={({ field }) => (
                  <ColorPicker
                    id="project-color"
                    value={field.value ?? ''}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    aria-invalid={!!errors.color}
                  />
                )}
              />
            </FormField>
            <FormField
              label="Заметки"
              htmlFor="project-notes"
              error={errors.notes?.message}
              invalid={!!errors.notes}
            >
              <Textarea
                id="project-notes"
                rows={3}
                aria-invalid={!!errors.notes}
                {...register('notes')}
              />
            </FormField>
          </>
        )
      }}
    </FormSheetRhf>
  )
}
