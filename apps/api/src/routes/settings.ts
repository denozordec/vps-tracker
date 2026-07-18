import type { FastifyPluginAsync } from 'fastify'
import { settingsIdForSpace, getCurrentSpaceId } from '@cfdm/db'
import { settingsRepository } from '@cfdm/db/repositories/settings'
import { settingsSchema, telegramTestBodySchema } from '@cfdm/shared/contracts/settings'

import { restartScheduler } from '../services/scheduler.js'
import { sendTelegramMessage } from '../services/telegram.js'
import { deliverWebhook } from '../services/notifications/channels.js'
import { requireSpaceRole } from '../plugins/space.js'

export const settingsRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/settings', async () => settingsRepository.list())

  app.post('/api/settings', async (req, reply) => {
    if (!requireSpaceRole(req, reply, 'admin')) return
    const parsed = settingsSchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: { code: 'VALIDATION', message: parsed.error.message } })
    }
    const spaceId = getCurrentSpaceId()
    const id =
      (req.body as { id?: string })?.id ?? settingsIdForSpace(spaceId)
    const result = settingsRepository.upsertForSpace(spaceId, {
      ...parsed.data,
    })
    // Keep id stable
    if (result.id !== id) {
      /* upsertForSpace picks correct id */
    }
    restartScheduler()
    return reply.code(201).send(result)
  })

  app.put<{ Params: { id: string } }>('/api/settings/:id', async (req, reply) => {
    if (!requireSpaceRole(req, reply, 'admin')) return
    const parsed = settingsSchema.partial().safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: { code: 'VALIDATION', message: parsed.error.message } })
    }
    const spaceId = getCurrentSpaceId()
    const result = settingsRepository.upsertForSpace(spaceId, parsed.data)
    restartScheduler()
    return result
  })

  app.post('/api/settings/telegram/test', async (req) => {
    const parsed = telegramTestBodySchema.safeParse(req.body ?? {})
    const body = parsed.success ? parsed.data : {}
    const settings = settingsRepository.getBySpace(getCurrentSpaceId())

    const token = body.telegramBotToken?.trim() || settings?.telegramBotToken?.trim() || ''
    const chatId = body.telegramChatId?.trim() || settings?.telegramChatId?.trim() || ''
    const messageThreadId =
      body.telegramMessageThreadId !== undefined
        ? body.telegramMessageThreadId
        : settings?.telegramMessageThreadId

    if (!token || !chatId) {
      return { ok: false, error: 'Укажите токен бота и chat ID в настройках' }
    }
    const result = await sendTelegramMessage(
      token,
      chatId,
      '✅ VPS Tracker: тестовое сообщение',
      messageThreadId,
    )
    return result.ok ? { ok: true } : { ok: false, error: result.error ?? 'Ошибка Telegram API' }
  })

  app.post('/api/settings/webhook/test', async () => {
    const settings = settingsRepository.getBySpace(getCurrentSpaceId())
    if (!settings?.webhookEnabled) {
      return { ok: false, error: 'Включите webhook в настройках' }
    }
    const result = await deliverWebhook(settings, {
      event: 'test',
      message: 'VPS Tracker: тестовое webhook-сообщение',
      timestamp: new Date().toISOString(),
      data: { source: 'settings_test' },
    })
    return result.ok ? { ok: true } : { ok: false, error: result.error ?? 'Ошибка webhook' }
  })
}
