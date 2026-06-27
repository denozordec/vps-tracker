import type { FastifyPluginAsync } from 'fastify'
import { settingsRepository } from '@cfdm/db/repositories/settings'
import { settingsSchema } from '@cfdm/shared/contracts/settings'

import { restartScheduler } from '../services/scheduler.js'
import { sendTelegramMessage } from '../services/telegram.js'

export const settingsRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/settings', async () => settingsRepository.list())

  app.post('/api/settings', async (req, reply) => {
    const parsed = settingsSchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: { code: 'VALIDATION', message: parsed.error.message } })
    }
    const id = (req.body as { id?: string })?.id ?? 'settings-main'
    const result = settingsRepository.upsert(id, parsed.data)
    restartScheduler()
    return reply.code(201).send(result)
  })

  app.put<{ Params: { id: string } }>('/api/settings/:id', async (req, reply) => {
    const parsed = settingsSchema.partial().safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: { code: 'VALIDATION', message: parsed.error.message } })
    }
    const result = settingsRepository.upsert(req.params.id, parsed.data)
    restartScheduler()
    return result
  })

  app.post('/api/settings/telegram/test', async () => {
    const settings = settingsRepository.getRow('settings-main')
    if (!settings?.telegramBotToken?.trim() || !settings.telegramChatId?.trim()) {
      return { ok: false, error: 'Укажите токен бота и chat ID в настройках' }
    }
    await sendTelegramMessage(
      settings.telegramBotToken,
      settings.telegramChatId,
      '✅ VPS Tracker: тестовое сообщение',
      settings.telegramMessageThreadId,
    )
    return { ok: true }
  })
}
