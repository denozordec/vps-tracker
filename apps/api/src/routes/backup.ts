import type { FastifyPluginAsync } from 'fastify'
import { existsSync } from 'node:fs'
import {
  getDbPath,
  readDatabaseFileBuffer,
  reloadDatabaseFromBuffer,
} from '@cfdm/db'
import { spacesRepository } from '@cfdm/db/repositories/spaces'

import { importJsonSnapshot, type BackupPayload } from '../services/backup-import.js'
import {
  FULL_BACKUP_VERSION,
  getFullBackupSnapshot,
  importFullBackup,
  type FullBackupPayload,
} from '../services/backup-full.js'
import { restartScheduler } from '../services/scheduler.js'

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
    const snapshot = getFullBackupSnapshot()
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
        const data = payload as FullBackupPayload
        if (data.tables && typeof data.tables === 'object') {
          importFullBackup(data)
        } else {
          importJsonSnapshot(payload as BackupPayload)
        }
        void FULL_BACKUP_VERSION
        spacesRepository.getMain()
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
        spacesRepository.getMain()
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
