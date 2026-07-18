import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { snapshotQueryOptions } from '@/queries/snapshot'
import { api, ApiError } from '@/lib/api-client'
import { parseCustomFieldDefs } from '@cfdm/shared/contracts/custom-fields'
import type { SettingsFormValues } from '@/lib/schemas'
import type { Settings } from '@/types/entities'

export function settingsToFormValues(s: Settings): SettingsFormValues {
  return {
    id: s.id,
    baseCurrency: s.baseCurrency ?? 'RUB',
    ratesUrl: s.ratesUrl ?? '',
    autoConvert: s.autoConvert !== false,
    syncEnabled: s.syncEnabled !== false,
    syncIntervalMinutes: s.syncIntervalMinutes ?? 60,
    syncTariffsIntervalMinutes: s.syncTariffsIntervalMinutes ?? 1440,
    telegramChatId: s.telegramChatId ?? '',
    telegramBotToken: '',
    notifyPaymentExpiryEnabled: s.notifyPaymentExpiryEnabled !== false,
    notifyNewTariffsEnabled: s.notifyNewTariffsEnabled !== false,
    notifyLowBalanceEnabled: s.notifyLowBalanceEnabled !== false,
    notifySyncDigestEnabled: s.notifySyncDigestEnabled !== false,
    notifyVpsDownEnabled: s.notifyVpsDownEnabled !== false,
    notifyIntervalMinutes: s.notifyIntervalMinutes ?? 60,
    uptimeCheckIntervalMinutes: s.uptimeCheckIntervalMinutes ?? 5,
    webhookUrl: s.webhookUrl ?? '',
    webhookEnabled: s.webhookEnabled === true,
    customFields: parseCustomFieldDefs(s.customFields),
    telegramMessageThreadId: s.telegramMessageThreadId ?? '',
    showQuickActions: s.showQuickActions !== false,
  }
}

export function buildSettingsSavePayload(
  r: Partial<SettingsFormValues>,
): Partial<SettingsFormValues> {
  const { telegramBotToken, ...rest } = r
  const token = telegramBotToken?.trim() ?? ''
  return token ? { ...rest, telegramBotToken: token } : rest
}

export function useSettingsSnapshot() {
  const query = useQuery(snapshotQueryOptions())
  const current = query.data?.settings?.[0] as Settings | undefined
  return { ...query, current }
}

export function useSettingsSave(options?: { successMessage?: string }) {
  const queryClient = useQueryClient()
  const { current } = useSettingsSnapshot()
  const successMessage = options?.successMessage ?? 'Настройки сохранены'

  return useMutation({
    mutationFn: (patch: Partial<SettingsFormValues>) => {
      const payload = buildSettingsSavePayload(patch)
      if (current?.id) return api.update<Settings>('settings', current.id, payload)
      return api.create<Settings>('settings', {
        id: 'settings-main',
        ratesUrl: 'https://www.cbr-xml-daily.ru/latest.js',
        ...payload,
      } as Settings)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: snapshotQueryOptions().queryKey })
      toast.success(successMessage)
    },
    onError: (e: unknown) =>
      toast.error(e instanceof ApiError ? e.message : 'Не удалось сохранить'),
  })
}

export function useSettingsPatch(options?: { successMessage?: string }) {
  const queryClient = useQueryClient()
  const { current } = useSettingsSnapshot()
  const successMessage = options?.successMessage ?? 'Настройки сохранены'

  return useMutation({
    mutationFn: (patch: Partial<Settings>) => {
      if (!current?.id) {
        return api.create<Settings>('settings', {
          id: 'settings-main',
          ratesUrl: 'https://www.cbr-xml-daily.ru/latest.js',
          ...patch,
        } as Settings)
      }
      return api.update<Settings>('settings', current.id, patch)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: snapshotQueryOptions().queryKey })
      toast.success(successMessage)
    },
    onError: (e: unknown) =>
      toast.error(e instanceof ApiError ? e.message : 'Не удалось сохранить'),
  })
}
