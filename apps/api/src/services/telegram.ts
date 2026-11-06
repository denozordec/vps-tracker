/**
 * Telegram Bot API — отправка уведомлений
 */

import {
  DEFAULT_TELEGRAM_API_URL,
  normalizeTelegramApiUrl,
} from '@cfdm/shared/contracts/settings'

export { DEFAULT_TELEGRAM_API_URL, normalizeTelegramApiUrl }

export function telegramSendMessageUrl(token: string, apiUrl?: string | null): string {
  return `${normalizeTelegramApiUrl(apiUrl)}/bot${token.trim()}/sendMessage`
}

export interface TelegramSendResult {
  ok: boolean
  error?: string
}

interface TelegramApiResponse {
  ok?: boolean
  description?: string
  error_code?: number
}

/** Маппинг частых ошибок Telegram API на подсказки (для тестов и UI). */
export function telegramErrorHint(description: string): string | null {
  const d = description.toLowerCase()
  if (d.includes('message thread not found')) {
    return 'Проверьте Thread ID и что в группе включены топики'
  }
  if (d.includes('chat not found')) {
    return 'Бот не добавлен в чат или неверный Chat ID'
  }
  if (d.includes('not enough rights')) {
    return 'Дайте боту право отправлять сообщения (администратор в группе)'
  }
  if (d.includes('unauthorized')) {
    return 'Неверный токен бота'
  }
  if (d.includes('bot was blocked')) {
    return 'Пользователь заблокировал бота'
  }
  return null
}

export function formatTelegramApiError(
  chatId: string,
  res: Pick<Response, 'status' | 'statusText'>,
  data: TelegramApiResponse,
  rawBody?: string,
): string {
  const description = data.description?.trim()
  if (description) {
    const hint = telegramErrorHint(description)
    return hint ? `${chatId}: ${description} — ${hint}` : `${chatId}: ${description}`
  }
  const snippet = rawBody?.trim().slice(0, 200)
  const fallback = snippet || res.statusText || `HTTP ${res.status}`
  return `${chatId}: ${fallback}`
}

const TELEGRAM_TIMEOUT_MS = 10_000
/** Telegram rejects text over 4096 chars; cut at a line break so no HTML entity/tag is split. */
const TELEGRAM_MAX_TEXT = 4096

export function fitTelegramText(text: string): string {
  if (text.length <= TELEGRAM_MAX_TEXT) return text
  const lines = text.split('\n')
  const kept: string[] = []
  let len = 0
  const reserve = 40 // room for the "and N more" tail
  for (const line of lines) {
    if (len + line.length + 1 > TELEGRAM_MAX_TEXT - reserve) break
    kept.push(line)
    len += line.length + 1
  }
  if (kept.length === 0) return text.slice(0, TELEGRAM_MAX_TEXT - 1) + '…'
  return `${kept.join('\n')}\n… и ещё ${lines.length - kept.length} строк`
}

export async function sendTelegramMessage(
  token: string,
  chatIds: string | string[],
  text: string,
  messageThreadId?: string | number | null,
  apiUrl?: string | null,
): Promise<TelegramSendResult> {
  if (!token?.trim() || !text?.trim()) {
    return { ok: false, error: 'Пустой токен или текст' }
  }
  const ids = Array.isArray(chatIds)
    ? chatIds
    : String(chatIds || '')
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean)
  if (ids.length === 0) return { ok: false, error: 'Не указан chat ID' }

  const threadId = messageThreadId != null && messageThreadId !== '' ? Number(messageThreadId) : null
  const payload: Record<string, unknown> = {
    text: fitTelegramText(text),
    parse_mode: 'HTML',
    disable_web_page_preview: true,
  }
  if (Number.isFinite(threadId)) payload.message_thread_id = threadId

  const url = telegramSendMessageUrl(token, apiUrl)
  const errors: string[] = []
  let anyOk = false

  for (const chatId of ids) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, chat_id: chatId }),
        // A hung API/proxy would otherwise block the notify tick (and every tick skipped behind it).
        signal: AbortSignal.timeout(TELEGRAM_TIMEOUT_MS),
      })
      const rawBody = await res.text()
      let data: TelegramApiResponse = {}
      try {
        data = JSON.parse(rawBody) as TelegramApiResponse
      } catch {
        /* non-JSON body */
      }
      if (data.ok) {
        anyOk = true
      } else {
        const err = formatTelegramApiError(chatId, res, data, rawBody)
        errors.push(err)
        console.warn(`Telegram sendMessage failed for chat ${chatId}:`, err)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      errors.push(`${chatId}: ${message}`)
      console.warn(`Telegram sendMessage error for chat ${chatId}:`, message)
    }
  }

  // Partial delivery counts as sent, but the failed chats still reach the journal.
  if (anyOk) return errors.length ? { ok: true, error: errors.join('; ') } : { ok: true }
  return { ok: false, error: errors.join('; ') || 'Не удалось отправить' }
}
