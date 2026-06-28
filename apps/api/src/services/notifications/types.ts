export const NOTIFICATION_EVENTS = [
  'payment_expiry',
  'sync_digest',
  'low_balance',
  'new_tariffs',
  'vps_down',
  'vps_up',
] as const

export type NotificationEvent = (typeof NOTIFICATION_EVENTS)[number]

export type NotificationChannel = 'telegram' | 'webhook'

export type DedupMode = 'daily' | 'fingerprint' | 'state_transition'

export interface NotificationPayload {
  event: NotificationEvent
  fingerprint: string
  messagePlain: string
  messageHtml?: string
  data?: Record<string, unknown>
  dedup: DedupMode
  stateKey?: string
  newStatus?: string
}

export interface SettingsNotifyRow {
  telegramBotToken?: string | null
  telegramChatId?: string | null
  telegramMessageThreadId?: string | null
  webhookUrl?: string | null
  webhookEnabled?: number | boolean | null
  notifyPaymentExpiryEnabled?: number | boolean | null
  notifyNewTariffsEnabled?: number | boolean | null
  notifyLowBalanceEnabled?: number | boolean | null
  notifySyncDigestEnabled?: number | boolean | null
  notifyVpsDownEnabled?: number | boolean | null
}

export function isNotifyFlagEnabled(flag: number | boolean | null | undefined): boolean {
  return flag !== 0 && flag !== false
}

export function eventEnabled(settings: SettingsNotifyRow, event: NotificationEvent): boolean {
  switch (event) {
    case 'payment_expiry':
      return isNotifyFlagEnabled(settings.notifyPaymentExpiryEnabled)
    case 'sync_digest':
      return isNotifyFlagEnabled(settings.notifySyncDigestEnabled)
    case 'low_balance':
      return isNotifyFlagEnabled(settings.notifyLowBalanceEnabled)
    case 'new_tariffs':
      return isNotifyFlagEnabled(settings.notifyNewTariffsEnabled)
    case 'vps_down':
    case 'vps_up':
      return isNotifyFlagEnabled(settings.notifyVpsDownEnabled)
    default:
      return false
  }
}
