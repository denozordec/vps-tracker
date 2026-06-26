import type { FastifyPluginAsync } from 'fastify'
import { existsSync, readFileSync } from 'node:fs'
import { getDbPath } from '@cfdm/db'
import { getSnapshot } from '@cfdm/db/repositories/snapshot'

const BACKUP_VERSION = 1

export const backupRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/backup/json', async (_req, reply) => {
    const snapshot = { backupVersion: BACKUP_VERSION, exportedAt: new Date().toISOString(), ...getSnapshot() }
    reply.header('Content-Type', 'application/json; charset=utf-8')
    reply.header('Content-Disposition', 'attachment; filename="vps-tracker-backup.json"')
    return reply.send(JSON.stringify(snapshot, null, 2))
  })

  app.get('/api/backup/database', async (_req, reply) => {
    const dbPath = getDbPath()
    if (!existsSync(dbPath)) {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Файл базы не найден' } })
    }
    const buf = readFileSync(dbPath)
    reply.header('Content-Type', 'application/octet-stream')
    reply.header('Content-Disposition', 'attachment; filename="vps-tracker.db"')
    return reply.send(buf)
  })

  app.post('/api/backup/json', async (req, reply) => {
    const payload = req.body
    if (!payload || typeof payload !== 'object') {
      return reply.code(400).send({ error: { code: 'VALIDATION', message: 'Неверное тело запроса' } })
    }
    // TODO: implement JSON snapshot import via repositories
    return reply.code(501).send({ error: { code: 'NOT_IMPLEMENTED', message: 'JSON import pending migration' } })
  })

  app.post('/api/backup/database', async (req, reply) => {
    const buf = req.body as Buffer
    if (!buf || !buf.length) {
      return reply.code(400).send({ error: { code: 'VALIDATION', message: 'Пустой файл' } })
    }
    // TODO: implement DB restore via better-sqlite3 backup API
    return reply.code(501).send({ error: { code: 'NOT_IMPLEMENTED', message: 'DB restore pending migration' } })
  })
}
