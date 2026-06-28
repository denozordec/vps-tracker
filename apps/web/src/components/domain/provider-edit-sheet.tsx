import { FormSheetRhf } from '@/components/form-sheet-rhf'
import { FormField } from '@/components/form-field'
import { Input } from '@cfdm/ui/components/input'
import { Textarea } from '@cfdm/ui/components/textarea'
import { SelectField } from '@/components/select-field'
import type { ZodType } from 'zod'
import { providerSchema, type ProviderFormValues } from '@/lib/schemas'
import type { ApiType } from '@/types/entities'

const EMPTY: ProviderFormValues = {
  name: '',
  website: '',
  apiType: 'billmanager',
  apiBaseUrl: '',
  baseCurrency: 'RUB',
  usdRate: '',
  eurRate: '',
  supportPhone: '',
  supportUrl: '',
  notes: '',
}

interface ProviderEditSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultValues?: ProviderFormValues
  onSubmit: (values: ProviderFormValues) => void
  submitting?: boolean
}

export function providerFormDefaults(edit?: ProviderFormValues | null): ProviderFormValues {
  return edit ? { ...EMPTY, ...edit } : EMPTY
}

export { EMPTY as providerFormEmpty }

export function ProviderEditSheet({
  open,
  onOpenChange,
  defaultValues = EMPTY,
  onSubmit,
  submitting,
}: ProviderEditSheetProps) {
  return (
    <FormSheetRhf
      open={open}
      onOpenChange={onOpenChange}
      title={defaultValues.id ? 'Редактировать хостера' : 'Новый хостер'}
      schema={providerSchema as unknown as ZodType<ProviderFormValues>}
      defaultValues={defaultValues}
      onSubmit={onSubmit}
      submitting={submitting}
    >
      {(form) => {
        const { register, formState: { errors }, watch, setValue } = form
        return (
          <>
            <FormField label="Название" htmlFor="pr-name" error={errors.name?.message} invalid={!!errors.name}>
              <Input id="pr-name" aria-invalid={!!errors.name} {...register('name')} />
            </FormField>
            <FormField label="Сайт" htmlFor="pr-site" error={errors.website?.message}>
              <Input id="pr-site" {...register('website')} />
            </FormField>
            <FormField label="Тип API" htmlFor="pr-api">
              <SelectField
                triggerId="pr-api"
                value={watch('apiType')}
                onValueChange={(v) => setValue('apiType', (v ?? 'none') as ApiType, { shouldValidate: true })}
                options={[
                  { value: 'billmanager', label: 'BILLmanager' },
                  { value: 'none', label: 'Нет' },
                ]}
              />
            </FormField>
            <FormField label="API URL" htmlFor="pr-apiurl" description="Один URL на хостера для BILLmanager">
              <Input id="pr-apiurl" {...register('apiBaseUrl')} />
            </FormField>
            <div className="grid grid-cols-3 gap-3">
              <FormField label="Валюта" htmlFor="pr-cur">
                <Input id="pr-cur" {...register('baseCurrency')} />
              </FormField>
              <FormField label="Курс USD" htmlFor="pr-usd">
                <Input id="pr-usd" {...register('usdRate')} />
              </FormField>
              <FormField label="Курс EUR" htmlFor="pr-eur">
                <Input id="pr-eur" {...register('eurRate')} />
              </FormField>
            </div>
            <FormField label="Заметки" htmlFor="pr-notes">
              <Textarea id="pr-notes" {...register('notes')} />
            </FormField>
          </>
        )
      }}
    </FormSheetRhf>
  )
}
