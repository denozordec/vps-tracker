import { cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react'
import { Field, FieldError, FieldLabel } from '@cfdm/ui/components/field'

interface FormFieldProps {
  label: string
  htmlFor?: string
  error?: string
  invalid?: boolean
  description?: ReactNode
  children: ReactNode
}

function withFieldA11y(child: ReactNode, isInvalid: boolean, htmlFor?: string): ReactNode {
  if (!isValidElement(child)) return child

  const childProps = child.props as Record<string, unknown>
  const props: Record<string, unknown> = {}
  if (isInvalid) {
    props['aria-invalid'] = true
    props.invalid = true
  }
  if (htmlFor && childProps.id == null && childProps.triggerId == null) {
    if ('triggerId' in childProps) {
      props.triggerId = htmlFor
    } else {
      props.id = htmlFor
    }
  }

  return Object.keys(props).length > 0 ? cloneElement(child as ReactElement, props) : child
}

export function FormField({ label, htmlFor, error, invalid, description, children }: FormFieldProps) {
  const isInvalid = invalid || Boolean(error)

  return (
    <Field data-invalid={isInvalid}>
      <FieldLabel htmlFor={htmlFor}>{label}</FieldLabel>
      {withFieldA11y(children, isInvalid, htmlFor)}
      {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      {error ? <FieldError>{error}</FieldError> : null}
    </Field>
  )
}
