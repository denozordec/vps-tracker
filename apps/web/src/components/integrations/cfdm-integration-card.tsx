import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'

import { SettingRow } from '@/components/setting-row'
import { LoadingButton } from '@/components/loading-button'
import { FieldGroup } from '@cfdm/ui/components/field'
import { Input } from '@cfdm/ui/components/input'
import { Button } from '@cfdm/ui/components/button'
import { Switch } from '@cfdm/ui/components/switch'
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

interface CfdmIntegrationFormProps {
  settings?: Settings
  onSave: (values: {
    cfdmApiUrl?: string
    integrationToken?: string
    integrationEnabled: boolean
  }) => void
  isSaving?: boolean
}

/** CFDM integration form — Frame/SettingRow, no Card. Preview https://reui.io/preview/base/settings-3 */
export function CfdmIntegrationForm({
  settings,
  onSave,
  isSaving,
}: CfdmIntegrationFormProps) {
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
    <form
      className="flex flex-col gap-0"
      onSubmit={(e) => void form.handleSubmit(handleSubmit)(e)}
    >
      <FieldGroup className="gap-0">
        <SettingRow
          title="Принимать синхронизацию"
          description="Разрешить CFDM пушить домены и сервисы"
        >
          <Controller
            control={form.control}
            name="integrationEnabled"
            render={({ field }) => (
              <Switch
                checked={field.value}
                onCheckedChange={field.onChange}
                aria-label="Принимать синхронизацию"
              />
            )}
          />
        </SettingRow>
        <SettingRow
          title="URL API CFDM"
          description="Для failover vps_down"
          labelFor="cfdm-api-url"
          stacked
        >
          <Input
            id="cfdm-api-url"
            className="w-full"
            placeholder="http://192.168.100.67:6363"
            {...form.register('cfdmApiUrl')}
          />
        </SettingRow>
        <SettingRow
          title="Integration token"
          description={
            settings?.integrationTokenSet
              ? 'Токен установлен — введите новый для замены'
              : 'Сгенерируйте или вставьте токен'
          }
          labelFor="integration-token"
          stacked
          last={!settings?.integrationLastSyncAt}
        >
          <div className="flex w-full flex-col gap-2 sm:flex-row">
            <Input
              id="integration-token"
              type="password"
              autoComplete="new-password"
              className="min-w-0 flex-1"
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
              size="sm"
              className="shrink-0"
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
        </SettingRow>
        {settings?.integrationLastSyncAt ? (
          <SettingRow
            title="Последний sync"
            description={new Date(settings.integrationLastSyncAt).toLocaleString('ru-RU')}
            last
          >
            <span className="text-muted-foreground text-sm tabular-nums">
              {new Date(settings.integrationLastSyncAt).toLocaleString('ru-RU')}
            </span>
          </SettingRow>
        ) : null}
      </FieldGroup>
      <div className="flex justify-end border-t px-5 py-3">
        <LoadingButton
          type="submit"
          loading={isSaving}
          disabled={!form.formState.isDirty}
        >
          Сохранить интеграцию
        </LoadingButton>
      </div>
    </form>
  )
}

/** @deprecated Use CfdmIntegrationForm */
export const CfdmIntegrationCard = CfdmIntegrationForm
