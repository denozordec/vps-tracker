import { afterEach, describe, expect, it } from 'vitest'
import Database from 'better-sqlite3'
import { mkdtempSync, readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  closeDb,
  getDb,
  getSqlite,
  readDatabaseFileBuffer,
  reloadDatabaseFromBuffer,
} from './index.js'

describe('reloadDatabaseFromBuffer / readDatabaseFileBuffer', () => {
  let dir: string

  afterEach(() => {
    closeDb()
    delete process.env.DB_PATH
    if (dir && existsSync(dir)) rmSync(dir, { recursive: true, force: true })
  })

  it('rejects non-sqlite buffer', () => {
    dir = mkdtempSync(join(tmpdir(), 'vt-db-'))
    process.env.DB_PATH = join(dir, 'app.db')
    getDb()
    expect(() => reloadDatabaseFromBuffer(Buffer.from('not-a-db'))).toThrow(/SQLite/)
  })

  it('replaces db and drops leftover wal/shm', () => {
    dir = mkdtempSync(join(tmpdir(), 'vt-db-'))
    const dbPath = join(dir, 'app.db')
    process.env.DB_PATH = dbPath
    getDb()
    getSqlite().exec('CREATE TABLE IF NOT EXISTS t (id INTEGER PRIMARY KEY); INSERT INTO t VALUES (1);')
    closeDb()

    // Simulate stale sidecars after closed connection (Windows locks *-shm while open)
    writeFileSync(`${dbPath}-wal`, Buffer.alloc(32))
    writeFileSync(`${dbPath}-shm`, Buffer.alloc(32))

    const donorPath = join(dir, 'donor.db')
    const donor = new Database(donorPath)
    donor.exec(`CREATE TABLE ok (x TEXT); INSERT INTO ok VALUES ('yes');`)
    donor.close()
    const buf = readFileSync(donorPath)

    reloadDatabaseFromBuffer(buf)

    const row = getSqlite().prepare('SELECT x FROM ok').get() as { x: string }
    expect(row.x).toBe('yes')
    // Старый мусорный WAL не должен подмешаться: таблица t из прошлой БД отсутствует
    const tables = getSqlite()
      .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='t'`)
      .all()
    expect(tables).toHaveLength(0)
    closeDb()
  })

  it('readDatabaseFileBuffer checkpoints wal', () => {
    dir = mkdtempSync(join(tmpdir(), 'vt-db-'))
    process.env.DB_PATH = join(dir, 'app.db')
    getDb()
    getSqlite().exec('CREATE TABLE IF NOT EXISTS t (id INTEGER PRIMARY KEY); INSERT INTO t VALUES (42);')
    const buf = readDatabaseFileBuffer()
    expect(buf.subarray(0, 15).toString('utf8')).toBe('SQLite format 3')
    expect(buf.length).toBeGreaterThan(100)
  })
})
