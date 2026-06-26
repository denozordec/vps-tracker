/**
 * Telegram Bot API — отправка уведомлений
 */

/**
 * @param {string} token - Bot token from @BotFather
 * @param {string|string[]} chatIds - Chat ID(s), comma-separated string or array
 * @param {string} text - Message text
 * @param {string|number} [messageThreadId] - ID топика в SuperGroup (для отправки в цепочку сообщений)
 * @returns {Promise<void>}
 */
export async function sendTelegramMessage(token, chatIds, text, messageThreadId) {
  if (!token?.trim() || !text?.trim()) return
  const ids = Array.isArray(chatIds)
    ? chatIds
    : String(chatIds || '')
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean)
  if (ids.length === 0) return

  const threadId = messageThreadId != null && messageThreadId !== '' ? Number(messageThreadId) : null
  const payload = {
    text,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
  }
  if (Number.isFinite(threadId)) payload.message_thread_id = threadId

  const url = `https://api.telegram.org/bot${token.trim()}/sendMessage`
  for (const chatId of ids) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payload,
          chat_id: chatId,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!data.ok) {
        console.warn(`Telegram sendMessage failed for chat ${chatId}:`, data.description || res.statusText)
      }
    } catch (err) {
      console.warn(`Telegram sendMessage error for chat ${chatId}:`, err.message)
    }
  }
}
