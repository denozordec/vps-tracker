import { useFieldArray, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { PlusIcon, Trash2Icon } from 'lucide-react'
import { z } from 'zod'
import { appSwitcherConfigSchema } from '@cfdm/shared/contracts/app-switcher'

import { Button } from '@cfdm/ui/components/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@cfdm/ui/components/card'
import { FieldGroup } from '@cfdm/ui/components/field'
import { Input } from '@cfdm/ui/components/input'
import { FormField } from '@/components/form-field'
import { SelectField } from '@/components/select-field'
import { LoadingButton } from '@/components/loading-button'
import { APP_SWITCHER_ICONS, type AppSwitcherIconName } from '@/lib/app-switcher-config'

const ICON_OPTIONS = (Object.keys(APP_SWITCHER_ICONS) as AppSwitcherIconName[]).map((icon) => ({
  value: icon,
  label: icon,
}))

const formSchema = z.object({
  menuLabel: z.string().min(1),
  apps: appSwitcherConfigSchema.shape.apps,
})

export type AppSwitcherFormValues = z.infer<typeof formSchema>

interface AppSwitcherEditorProps {
  defaultValues: AppSwitcherFormValues
  onSave: (values: AppSwitcherFormValues) => void
  isSaving?: boolean
}

export function AppSwitcherEditor({ defaultValues, onSave, isSaving }: AppSwitcherEditorProps) {
  const form = useForm<AppSwitcherFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues,
  })
  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'apps' })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Связанные приложения</CardTitle>
        <CardDescription>URL для переключателя в sidebar и deep links</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => void form.handleSubmit(onSave)(e)}
        >
          <FieldGroup>
            <FormField label="Заголовок меню" htmlFor="menu-label">
              <Input id="menu-label" {...form.register('menuLabel')} />
            </FormField>
            {fields.map((field, index) => (
              <div key={field.id} className="grid gap-3 rounded-lg border p-3 md:grid-cols-2">
                <FormField label="ID" htmlFor={`app-id-${index}`}>
                  <Input id={`app-id-${index}`} {...form.register(`apps.${index}.id`)} />
                </FormField>
                <FormField label="Название" htmlFor={`app-name-${index}`}>
                  <Input id={`app-name-${index}`} {...form.register(`apps.${index}.name`)} />
                </FormField>
                <FormField label="URL" htmlFor={`app-url-${index}`}>
                  <Input id={`app-url-${index}`} className="md:col-span-2" {...form.register(`apps.${index}.url`)} />
                </FormField>
                <FormField label="Иконка" htmlFor={`app-icon-${index}`}>
                  <SelectField
                    triggerId={`app-icon-${index}`}
                    value={form.watch(`apps.${index}.icon`)}
                    onValueChange={(v) =>
                      form.setValue(`apps.${index}.icon`, (v ?? 'server') as AppSwitcherIconName, {
                        shouldDirty: true,
                      })
                    }
                    options={ICON_OPTIONS}
                  />
                </FormField>
                <div className="flex items-end justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    disabled={fields.length <= 1}
                    onClick={() => remove(index)}
                  >
                    <Trash2Icon className="size-4" />
                  </Button>
                </div>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              className="w-fit"
              onClick={() =>
                append({
                  id: `app-${fields.length + 1}`,
                  name: 'Приложение',
                  url: 'http://localhost:3000',
                  icon: 'server',
                })
              }
            >
              <PlusIcon data-icon="inline-start" />
              Добавить приложение
            </Button>
          </FieldGroup>
          <LoadingButton type="submit" className="w-fit" loading={isSaving} disabled={!form.formState.isDirty}>
            Сохранить приложения
          </LoadingButton>
        </form>
      </CardContent>
    </Card>
  )
}
