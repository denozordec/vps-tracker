import Database from 'better-sqlite3'
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import * as schema from './schema/index.js'
import { ensureRuntimeSchema } from './runtime-migrate.js'

const SQLITE_HEADER = Buffer.from('SQLite format 3\0')

export type Db = BetterSQLite3Database<typeof schema>

let _db: Db | null = null
let _sqlite: Database.Database | null = null

const DEFAULT_DB_PATH = resolve(process.cwd(), 'data', 'vps-tracker.db')

export function getDbPath(): string {
  return process.env.DB_PATH ?? DEFAULT_DB_PATH
}

export function getDb(): Db {
  if (_db) return _db
  openDatabase()
  return _db!
}

function openDatabase(): void {
  const dbPath = getDbPath()
  const dir = dirname(dbPath)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  _sqlite = new Database(dbPath)
  _sqlite.pragma('journal_mode = WAL')
  _sqlite.pragma('foreign_keys = ON')
  _db = drizzle(_sqlite, { schema })
  ensureRuntimeSchema(_sqlite)
}

export function getSqlite(): Database.Database {
  getDb()
  return _sqlite!
}

export function closeDb(): void {
  if (_sqlite) {
    _sqlite.close()
    _sqlite = null
    _db = null
  }
}

function removeSidecarFiles(dbPath: string): void {
  for (const suffix of ['-wal', '-shm'] as const) {
    const side = `${dbPath}${suffix}`
    if (existsSync(side)) unlinkSync(side)
  }
}

/**
 * Согласованный снимок файла БД: checkpoint WAL → чтение основного файла.
 * Без checkpoint экспорт может быть неполным (данные только в *-wal).
 */
export function readDatabaseFileBuffer(): Buffer {
  const sqlite = getSqlite()
  sqlite.pragma('wal_checkpoint(TRUNCATE)')
  return readFileSync(getDbPath())
}

/** Заменить файл SQLite и переоткрыть соединение. */
export function reloadDatabaseFromBuffer(buffer: Buffer): void {
  if (!Buffer.isBuffer(buffer) || buffer.length < SQLITE_HEADER.length) {
    throw new Error('Файл не похож на SQLite базу')
  }
  if (!buffer.subarray(0, SQLITE_HEADER.length).equals(SQLITE_HEADER)) {
    throw new Error('Файл не похож на SQLite базу (неверный заголовок)')
  }

  const dbPath = getDbPath()
  const dir = dirname(dbPath)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })

  closeDb()
  // Старые WAL/SHM от предыдущей БД ломают открытие нового файла
  removeSidecarFiles(dbPath)
  writeFileSync(dbPath, buffer)
  openDatabase()
}

export { schema }
export {
  MAIN_SPACE_ID,
  getCurrentSpaceId,
  runWithSpace,
  runWithSpaceAsync,
  settingsIdForSpace,
} from './space-context.js'
export {
  consolidateAllProviderApiSources,
  consolidateProviderApiFromAccounts,
  heuristicBillmanagerProviderApi,
} from './maintenance/consolidate-api.js'
