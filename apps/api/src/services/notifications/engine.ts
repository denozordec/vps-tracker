import { notificationRepository } from '@cfdm/db/repositories/notifications'
import { activeChannels, deliverTelegram, deliverWebhook } from './channels.js'
import { markDedupSent, shouldSkipDedup } from './dedup.js'
import { eventEnabled, type NotificationPayload, type SettingsNotifyRow } from './types.js'

export async function publishNotification(
  settings: SettingsNotifyRow,
  payload: NotificationPayload,
): Promise<'sent' | 'skipped' | 'failed'> {
  if (!eventEnabled(settings, payload.event)) return 'skipped'
  const channels = activeChannels(settings)
  if (channels.length === 0) return 'skipped'

  if (
    shouldSkipDedup(
      payload.event,
      payload.fingerprint,
      payload.dedup,
      payload.stateKey,
      payload.newStatus,
    )
  ) {
    for (const channel of channels) {
      notificationRepository.append({
        event: payload.event,
        channel,
        status: 'skipped',
        fingerprint: payload.fingerprint,
        message: payload.messagePlain,
        payload: payload.data,
      })
    }
    return 'skipped'
  }

  let anySent = false
  let anyFailed = false

  for (const channel of channels) {
    if (channel === 'telegram') {
      const result = await deliverTelegram(settings, payload.messageHtml ?? payload.messagePlain)
      notificationRepository.append({
        event: payload.event,
        channel,
        status: result.ok ? 'sent' : 'failed',
        fingerprint: payload.fingerprint,
        message: payload.messagePlain,
        payload: { ...payload.data, error: result.error },
      })
      if (result.ok) anySent = true
      else anyFailed = true
    } else {
      const result = await deliverWebhook(settings, {
        event: payload.event,
        message: payload.messagePlain,
        data: payload.data,
        timestamp: new Date().toISOString(),
      })
      notificationRepository.append({
        event: payload.event,
        channel,
        status: result.ok ? 'sent' : 'failed',
        fingerprint: payload.fingerprint,
        message: payload.messagePlain,
        payload: { ...payload.data, error: result.error },
      })
      if (result.ok) anySent = true
      else anyFailed = true
    }
  }

  if (anySent) {
    markDedupSent(
      payload.event,
      payload.fingerprint,
      payload.dedup,
      payload.stateKey,
      payload.newStatus,
    )
  }

  if (anySent) return 'sent'
  if (anyFailed) return 'failed'
  return 'skipped'
}

export async function publishMany(
  settings: SettingsNotifyRow,
  payloads: (NotificationPayload | null)[],
): Promise<void> {
  for (const payload of payloads) {
    if (payload) await publishNotification(settings, payload)
  }
}
