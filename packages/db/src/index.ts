import Database from 'better-sqlite3'
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import * as schema from './schema/index.js'

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

/** Заменить файл SQLite и переоткрыть соединение. */
export function reloadDatabaseFromBuffer(buffer: Buffer): void {
  closeDb()
  writeFileSync(getDbPath(), buffer)
  openDatabase()
}

export { schema }
export {
  consolidateAllProviderApiSources,
  consolidateProviderApiFromAccounts,
  heuristicBillmanagerProviderApi,
} from './maintenance/consolidate-api.js'
