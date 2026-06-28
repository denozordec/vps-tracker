import { FormSheetRhf } from '@/components/form-sheet-rhf'
import { FormField } from '@/components/form-field'
import { Input } from '@cfdm/ui/components/input'
import { projectSchema, type ProjectFormValues } from '@/lib/schemas'

const EMPTY: ProjectFormValues = { name: '' }

interface ProjectEditSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (values: ProjectFormValues) => void
  submitting?: boolean
}

export function ProjectEditSheet({ open, onOpenChange, onSubmit, submitting }: ProjectEditSheetProps) {
  return (
    <FormSheetRhf
      open={open}
      onOpenChange={onOpenChange}
      title="Новый проект"
      description="Имя будет доступно в автодополнении на форме VPS"
      schema={projectSchema}
      defaultValues={EMPTY}
      onSubmit={onSubmit}
      submitting={submitting}
    >
      {(form) => {
        const { register, formState: { errors } } = form
        return (
          <FormField label="Название" htmlFor="project-name" error={errors.name?.message} invalid={!!errors.name}>
            <Input id="project-name" aria-invalid={!!errors.name} {...register('name')} />
          </FormField>
        )
      }}
    </FormSheetRhf>
  )
}
