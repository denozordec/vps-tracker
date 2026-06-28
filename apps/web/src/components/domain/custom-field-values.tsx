import { type UseFormSetValue, type UseFormWatch } from 'react-hook-form'

import { Input } from '@cfdm/ui/components/input'
import { Checkbox } from '@cfdm/ui/components/checkbox'
import { Label } from '@cfdm/ui/components/label'
import { Separator } from '@cfdm/ui/components/separator'
import { FormField } from '@/components/form-field'
import {
  NumberField,
  NumberFieldGroup,
  NumberFieldDecrement,
  NumberFieldIncrement,
  NumberFieldInput,
} from '@/components/reui/number-field'
import type { CustomFieldDef } from '@/lib/custom-fields'
import type { VpsFormValues } from '@/lib/schemas'

interface CustomFieldValuesProps {
  defs: CustomFieldDef[]
  watch: UseFormWatch<VpsFormValues>
  setValue: UseFormSetValue<VpsFormValues>
}

function setCustomFieldValue(
  setValue: UseFormSetValue<VpsFormValues>,
  watch: UseFormWatch<VpsFormValues>,
  key: string,
  value: string | number | boolean | undefined,
) {
  const current = watch('customData') ?? {}
  const next = { ...current }
  if (value === undefined || value === '') {
    delete next[key]
  } else {
    next[key] = value
  }
  setValue('customData', next, { shouldDirty: true })
}

export function CustomFieldValues({ defs, watch, setValue }: CustomFieldValuesProps) {
  if (defs.length === 0) return null

  const customData = watch('customData') ?? {}

  return (
    <>
      <Separator />
      <div className="flex flex-col gap-3">
        <p className="text-sm font-medium">Дополнительные поля</p>
        {defs.map((field) => {
          if (field.type === 'bool') {
            return (
              <div key={field.key} className="flex items-center gap-2">
                <Checkbox
                  id={`custom-${field.key}`}
                  checked={Boolean(customData[field.key])}
                  onCheckedChange={(v) => setCustomFieldValue(setValue, watch, field.key, Boolean(v))}
                />
                <Label htmlFor={`custom-${field.key}`} className="font-normal">
                  {field.label}
                </Label>
              </div>
            )
          }
          if (field.type === 'number') {
            const raw = customData[field.key]
            const numVal = typeof raw === 'number' && Number.isFinite(raw) ? raw : null
            return (
              <FormField key={field.key} label={field.label} htmlFor={`custom-${field.key}`}>
                <NumberField
                  id={`custom-${field.key}`}
                  value={numVal}
                  onValueChange={(v) =>
                    setCustomFieldValue(
                      setValue,
                      watch,
                      field.key,
                      v == null || !Number.isFinite(v) ? undefined : v,
                    )
                  }
                >
                  <NumberFieldGroup>
                    <NumberFieldDecrement />
                    <NumberFieldInput placeholder="0" />
                    <NumberFieldIncrement />
                  </NumberFieldGroup>
                </NumberField>
              </FormField>
            )
          }
          return (
            <FormField key={field.key} label={field.label} htmlFor={`custom-${field.key}`}>
              <Input
                id={`custom-${field.key}`}
                value={String(customData[field.key] ?? '')}
                onChange={(e) =>
                  setCustomFieldValue(
                    setValue,
                    watch,
                    field.key,
                    e.target.value || undefined,
                  )
                }
              />
            </FormField>
          )
        })}
      </div>
    </>
  )
}
