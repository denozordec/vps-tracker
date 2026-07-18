import type { FastifyPluginAsync } from 'fastify'
import { desc } from 'drizzle-orm'
import { existsSync } from 'node:fs'
import {
  getDb,
  getDbPath,
  readDatabaseFileBuffer,
  reloadDatabaseFromBuffer,
  schema,
} from '@cfdm/db'
import { getSnapshot } from '@cfdm/db/repositories/snapshot'

import { importJsonSnapshot, type BackupPayload } from '../services/backup-import.js'
import { restartScheduler } from '../services/scheduler.js'

const BACKUP_VERSION = 1

/** Лимит тела для импорта бэкапа (Fastify default = 1 MiB → 413). */
function backupBodyLimitBytes(): number {
  const raw = process.env.BACKUP_BODY_LIMIT_BYTES
  if (raw) {
    const n = Number(raw)
    if (Number.isFinite(n) && n > 0) return Math.floor(n)
  }
  return 100 * 1024 * 1024 // 100 MiB
}

export const backupRoutes: FastifyPluginAsync = async (app) => {
  const bodyLimit = backupBodyLimitBytes()

  app.addContentTypeParser(
    'application/octet-stream',
    { parseAs: 'buffer', bodyLimit },
    (_req, body, done) => {
      done(null, body)
    },
  )

  app.get('/api/backup/json', async (_req, reply) => {
    const syncLog = getDb()
      .select()
      .from(schema.syncLog)
      .orderBy(desc(schema.syncLog.startedAt))
      .limit(500)
      .all()
    const snapshot = {
      backupVersion: BACKUP_VERSION,
      exportedAt: new Date().toISOString(),
      ...getSnapshot(),
      syncLog,
    }
    reply.header('Content-Type', 'application/json; charset=utf-8')
    reply.header('Content-Disposition', 'attachment; filename="vps-tracker-backup.json"')
    return reply.send(JSON.stringify(snapshot, null, 2))
  })

  app.get('/api/backup/database', async (_req, reply) => {
    const dbPath = getDbPath()
    if (!existsSync(dbPath)) {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Файл базы не найден' } })
    }
    const buf = readDatabaseFileBuffer()
    reply.header('Content-Type', 'application/octet-stream')
    reply.header('Content-Disposition', 'attachment; filename="vps-tracker.db"')
    return reply.send(buf)
  })

  app.post(
    '/api/backup/json',
    { bodyLimit },
    async (req, reply) => {
      const payload = req.body
      if (!payload || typeof payload !== 'object') {
        return reply.code(400).send({ error: { code: 'VALIDATION', message: 'Неверное тело запроса' } })
      }
      try {
        importJsonSnapshot(payload as BackupPayload)
        restartScheduler()
        return { ok: true }
      } catch (err) {
        req.log.error(err)
        const message = err instanceof Error ? err.message : 'Импорт не удался'
        return reply.code(500).send({ error: { code: 'INTERNAL_ERROR', message } })
      }
    },
  )

  app.post(
    '/api/backup/database',
    { bodyLimit },
    async (req, reply) => {
      const buf = req.body as Buffer
      if (!Buffer.isBuffer(buf) || !buf.length) {
        return reply.code(400).send({ error: { code: 'VALIDATION', message: 'Пустой файл' } })
      }
      try {
        reloadDatabaseFromBuffer(buf)
        restartScheduler()
        return { ok: true }
      } catch (err) {
        req.log.error(err)
        const message = err instanceof Error ? err.message : 'Восстановление не удалось'
        return reply.code(500).send({ error: { code: 'INTERNAL_ERROR', message } })
      }
    },
  )
}
