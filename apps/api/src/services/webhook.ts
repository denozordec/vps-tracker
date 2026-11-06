export interface WebhookPayload {
  event: string
  message: string
  data?: Record<string, unknown>
  timestamp: string
}
