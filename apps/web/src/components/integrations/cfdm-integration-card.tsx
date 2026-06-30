import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@cfdm/ui/components/card'
import { FieldGroup } from '@cfdm/ui/components/field'
import { Input } from '@cfdm/ui/components/input'
import { FormField } from '@/components/form-field'
import { SelectField } from '@/components/select-field'
import { LoadingButton } from '@/components/loading-button'
import { Button } from '@cfdm/ui/components/button'
import type { Settings } from '@/types/entities'

const formSchema = z.object({
  cfdmApiUrl: z.string().optional().default(''),
  integrationToken: z.string().optional().default(''),
  integrationEnabled: z.boolean().default(false),
})

type FormValues = z.infer<typeof formSchema>

function generateToken(): string {
  const bytes = new Uint8Array(24)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

interface CfdmIntegrationCardProps {
  settings?: Settings
  onSave: (values: {
    cfdmApiUrl?: string
    integrationToken?: string
    integrationEnabled: boolean
  }) => void
  isSaving?: boolean
}

export function CfdmIntegrationCard({ settings, onSave, isSaving }: CfdmIntegrationCardProps) {
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    values: {
      cfdmApiUrl: settings?.cfdmApiUrl ?? '',
      integrationToken: '',
      integrationEnabled: settings?.integrationEnabled === true,
    },
  })

  function handleSubmit(values: FormValues) {
    const token = values.integrationToken?.trim()
    onSave({
      integrationEnabled: values.integrationEnabled,
      cfdmApiUrl: values.cfdmApiUrl?.trim() || undefined,
      ...(token ? { integrationToken: token } : {}),
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>CF Domain Manager</CardTitle>
        <CardDescription>
          Приём синхронизации доменов и сервисов из CFDM. Скопируйте токен в настройки CFDM.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="flex flex-col gap-4" onSubmit={(e) => void form.handleSubmit(handleSubmit)(e)}>
          <FieldGroup>
            <FormField label="URL API CFDM" htmlFor="cfdm-api-url">
              <Input
                id="cfdm-api-url"
                placeholder="http://192.168.100.67:6363 (для failover vps_down)"
                {...form.register('cfdmApiUrl')}
              />
            </FormField>
            <FormField label="Integration token" htmlFor="integration-token">
              <div className="flex gap-2">
                <Input
                  id="integration-token"
                  type="password"
                  autoComplete="new-password"
                  placeholder={
                    settings?.integrationTokenSet
                      ? 'Токен установлен — введите новый для замены'
                      : 'Сгенерируйте или вставьте токен'
                  }
                  {...form.register('integrationToken')}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    const token = generateToken()
                    form.setValue('integrationToken', token, { shouldDirty: true })
                    void navigator.clipboard.writeText(token)
                    toast.success('Токен сгенерирован и скопирован')
                  }}
                >
                  Сгенерировать
                </Button>
              </div>
            </FormField>
            <Controller
              control={form.control}
              name="integrationEnabled"
              render={({ field }) => (
                <FormField label="Принимать синхронизацию" htmlFor="integration-enabled">
                  <SelectField
                    triggerId="integration-enabled"
                    triggerClassName="w-32"
                    value={field.value ? 'on' : 'off'}
                    onValueChange={(v) => field.onChange((v ?? 'on') === 'on')}
                    options={[
                      { value: 'on', label: 'Вкл' },
                      { value: 'off', label: 'Выкл' },
                    ]}
                  />
                </FormField>
              )}
            />
            {settings?.integrationLastSyncAt ? (
              <p className="text-sm text-muted-foreground">
                Последний sync: {new Date(settings.integrationLastSyncAt).toLocaleString('ru-RU')}
              </p>
            ) : null}
          </FieldGroup>
          <LoadingButton type="submit" className="w-fit" loading={isSaving} disabled={!form.formState.isDirty}>
            Сохранить интеграцию
          </LoadingButton>
        </form>
      </CardContent>
    </Card>
  )
}
