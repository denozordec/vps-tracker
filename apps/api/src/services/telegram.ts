/**
 * Telegram Bot API — отправка уведомлений
 */

export interface TelegramSendResult {
  ok: boolean
  error?: string
}

export async function sendTelegramMessage(
  token: string,
  chatIds: string | string[],
  text: string,
  messageThreadId?: string | number | null,
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
    text,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
  }
  if (Number.isFinite(threadId)) payload.message_thread_id = threadId

  const url = `https://api.telegram.org/bot${token.trim()}/sendMessage`
  const errors: string[] = []
  let anyOk = false

  for (const chatId of ids) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, chat_id: chatId }),
      })
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; description?: string }
      if (data.ok) {
        anyOk = true
      } else {
        const err = data.description || res.statusText || 'Unknown error'
        errors.push(`${chatId}: ${err}`)
        console.warn(`Telegram sendMessage failed for chat ${chatId}:`, err)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      errors.push(`${chatId}: ${message}`)
      console.warn(`Telegram sendMessage error for chat ${chatId}:`, message)
    }
  }

  if (anyOk) return { ok: true }
  return { ok: false, error: errors.join('; ') || 'Не удалось отправить' }
}
