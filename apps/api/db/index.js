/**
 * Database initialization and access
 */

import initSqlJs from 'sql.js'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

import { SCHEMA } from './schema.js'
import { MIGRATIONS } from './migrations.js'
import { seed, isDbEmpty } from './seed.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
// db/ is in server/, so .. = server, .. again = project root
export const DB_PATH = join(__dirname, '..', '..', 'data', 'vps-tracker.db')
const SEED_DIR = join(__dirname, '..', '..', 'public', 'data')

let dbInstance = null
/** @type {import('sql.js').SqlJsStatic | null} */
let sqlJsFactory = null

export async function initDb() {
  const dataDir = join(__dirname, '..', '..', 'data')
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true })
  }

  const SQL = await initSqlJs()
  sqlJsFactory = SQL
  let db

  if (existsSync(DB_PATH)) {
    const fileBuffer = readFileSync(DB_PATH)
    db = new SQL.Database(fileBuffer)
  } else {
    db = new SQL.Database()
  }

  db.exec(SCHEMA)

  for (const m of MIGRATIONS) {
    try {
      m.run(db)
    } catch (err) {
      console.warn(`Migration ${m.name} failed:`, err.message)
    }
  }

  if (isDbEmpty(db)) {
    seed(db, SEED_DIR)
    const data = db.export()
    writeFileSync(DB_PATH, Buffer.from(data))
  }

  dbInstance = db
  if (existsSync(DB_PATH)) {
    saveDb()
  }
  return db
}

export function getDb() {
  if (!dbInstance) throw new Error('Database not initialized')
  return createDbWrapper(dbInstance)
}

function createDbWrapper(db) {
  return {
    /** One-off run: prepare, bind, step, free. Use for statements that run once. */
    run(sql, ...params) {
      const stmt = db.prepare(sql)
      stmt.bind(params)
      stmt.step()
      const changes = db.getRowsModified()
      stmt.free()
      saveDb()
      return { changes }
    },
    prepare(sql) {
      const stmt = db.prepare(sql)
      return {
        all(...params) {
          stmt.bind(params)
          const rows = []
          while (stmt.step()) {
            rows.push(stmt.getAsObject())
          }
          stmt.free()
          return rows
        },
        get(...params) {
          stmt.bind(params)
          const row = stmt.step() ? stmt.getAsObject() : null
          stmt.free()
          return row
        },
        run(...params) {
          stmt.bind(params)
          stmt.step()
          const changes = db.getRowsModified()
          stmt.free()
          saveDb()
          return { changes }
        },
      }
    },
  }
}

export function saveDb() {
  if (!dbInstance) return
  const data = dbInstance.export()
  writeFileSync(DB_PATH, Buffer.from(data))
}

/**
 * Заменить in-memory БД из буфера SQLite и сохранить на диск.
 * @param {Buffer|Uint8Array} buffer
 */
export async function reloadDatabaseFromBuffer(buffer) {
  const SQL = sqlJsFactory || (await initSqlJs())
  sqlJsFactory = SQL
  if (dbInstance) {
    dbInstance.close()
    dbInstance = null
  }
  const u8 = buffer instanceof Buffer ? new Uint8Array(buffer) : buffer
  dbInstance = new SQL.Database(u8)
  dbInstance.exec(SCHEMA)
  for (const m of MIGRATIONS) {
    try {
      m.run(dbInstance)
    } catch (err) {
      console.warn(`Migration ${m.name} after reload failed:`, err.message)
    }
  }
  saveDb()
}
