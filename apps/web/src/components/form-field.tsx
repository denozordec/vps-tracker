import type { ReactNode } from 'react'
import { Field, FieldError, FieldLabel } from '@cfdm/ui/components/field'

interface FormFieldProps {
  label: string
  htmlFor?: string
  error?: string
  invalid?: boolean
  description?: ReactNode
  children: ReactNode
}

export function FormField({ label, htmlFor, error, invalid, description, children }: FormFieldProps) {
  return (
    <Field data-invalid={invalid || Boolean(error)}>
      <FieldLabel htmlFor={htmlFor}>{label}</FieldLabel>
      {children}
      {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      {error ? <FieldError>{error}</FieldError> : null}
    </Field>
  )
}
