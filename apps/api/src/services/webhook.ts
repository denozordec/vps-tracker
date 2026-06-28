export interface WebhookPayload {
  event: string
  message: string
  data?: Record<string, unknown>
  timestamp: string
}

export async function sendWebhook(url: string, payload: WebhookPayload): Promise<void> {
  const target = url?.trim()
  if (!target) return
  try {
    const res = await fetch(target, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      console.warn(`Webhook failed (${res.status}): ${target}`)
    }
  } catch (err) {
    console.warn('Webhook error:', err instanceof Error ? err.message : err)
  }
}

export async function notifyWebhook(
  settings: { webhookUrl?: string | null; webhookEnabled?: number | boolean | null },
  event: string,
  message: string,
  data?: Record<string, unknown>,
): Promise<void> {
  if (!settings.webhookEnabled) return
  const url = settings.webhookUrl?.trim()
  if (!url) return
  await sendWebhook(url, {
    event,
    message,
    data,
    timestamp: new Date().toISOString(),
  })
}
