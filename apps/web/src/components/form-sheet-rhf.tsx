import { useEffect } from 'react'
import type { ReactNode } from 'react'
import {
  useForm,
  type DefaultValues,
  type FieldValues,
  type SubmitHandler,
  type UseFormReturn,
} from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import type { ZodType } from 'zod'

import { FormSheet } from './form-sheet'

interface FormSheetRhfProps<TField extends FieldValues> {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  schema: ZodType<TField>
  defaultValues: DefaultValues<TField>
  onSubmit: (values: TField) => void
  submitting?: boolean
  submitLabel?: string
  children: (form: UseFormReturn<TField>) => ReactNode
}

export function FormSheetRhf<TField extends FieldValues>({
  open,
  onOpenChange,
  title,
  description,
  schema,
  defaultValues,
  onSubmit,
  submitting,
  submitLabel,
  children,
}: FormSheetRhfProps<TField>) {
  const form = useForm<TField>({
    resolver: zodResolver(schema) as never,
    defaultValues: defaultValues as DefaultValues<TField>,
    mode: 'onBlur',
  })

  // Re-sync form values when the sheet opens or defaultValues change (e.g. edit vs create).
  useEffect(() => {
    if (open) {
      form.reset(defaultValues as DefaultValues<TField>)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultValues])

  const submit: SubmitHandler<TField> = (values) => onSubmit(values)

  return (
    <FormSheet
      open={open}
      onOpenChange={(o) => {
        if (!o) form.reset()
        onOpenChange(o)
      }}
      trigger={null}
      title={title}
      description={description}
      submitLabel={submitLabel}
      submitting={submitting}
      onSubmit={() => void form.handleSubmit(submit)()}
    >
      {children(form)}
    </FormSheet>
  )
}
