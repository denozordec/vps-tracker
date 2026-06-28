import { sendTelegramMessage } from '../telegram.js'
import type { WebhookPayload } from '../webhook.js'
import type { NotificationChannel, SettingsNotifyRow } from './types.js'

export async function deliverTelegram(
  settings: SettingsNotifyRow,
  messageHtml: string,
): Promise<{ ok: boolean; error?: string }> {
  const token = settings.telegramBotToken?.trim()
  const chatId = settings.telegramChatId?.trim()
  if (!token || !chatId) return { ok: false, error: 'Telegram не настроен' }
  return sendTelegramMessage(token, chatId, messageHtml, settings.telegramMessageThreadId)
}

export async function deliverWebhook(
  settings: SettingsNotifyRow,
  payload: WebhookPayload,
): Promise<{ ok: boolean; error?: string }> {
  if (!settings.webhookEnabled) return { ok: false, error: 'Webhook выключен' }
  const url = settings.webhookUrl?.trim()
  if (!url) return { ok: false, error: 'Webhook URL не указан' }
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

export function activeChannels(settings: SettingsNotifyRow): NotificationChannel[] {
  const channels: NotificationChannel[] = []
  if (settings.telegramBotToken?.trim() && settings.telegramChatId?.trim()) channels.push('telegram')
  if (settings.webhookEnabled && settings.webhookUrl?.trim()) channels.push('webhook')
  return channels
}
