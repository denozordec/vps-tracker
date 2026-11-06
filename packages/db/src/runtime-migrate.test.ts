import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { closeDb, getDb, getSqlite } from './index.js'
import { ensureRuntimeSchema, resetRuntimeMigrate } from './runtime-migrate.js'
import Database from 'better-sqlite3'
import { getSnapshot } from './repositories/snapshot.js'
import { runWithSpace, MAIN_SPACE_ID } from './space-context.js'

describe('ensureRuntimeSchema (empty DB)', () => {
  let dir: string

  afterEach(() => {
    closeDb()
    resetRuntimeMigrate()
    delete process.env.DB_PATH
    if (dir) rmSync(dir, { recursive: true, force: true })
  })

  it('bootstraps core tables and serves empty snapshot', () => {
    dir = mkdtempSync(join(tmpdir(), 'vps-tracker-db-'))
    process.env.DB_PATH = join(dir, 'fresh.db')
    resetRuntimeMigrate()
    closeDb()

    getDb()
    const tables = getSqlite()
      .prepare(
        `SELECT name FROM sqlite_master WHERE type='table' AND name IN ('vps','settings','providers','spaces')`,
      )
      .all() as { name: string }[]
    expect(tables.map((t) => t.name).sort()).toEqual([
      'providers',
      'settings',
      'spaces',
      'vps',
    ])

    const snap = runWithSpace(MAIN_SPACE_ID, () => getSnapshot())
    expect(snap.spaceId).toBe(MAIN_SPACE_ID)
    expect(snap.vps).toEqual([])
    expect(snap.settings.length).toBeGreaterThanOrEqual(1)
  })
})

describe('ensureRuntimeSchema (legacy DB without providers.apiType)', () => {
  afterEach(() => resetRuntimeMigrate())

  it('adds provider API columns and moves BILLmanager URL from accounts', () => {
    const sqlite = new Database(':memory:')
    sqlite.exec(`CREATE TABLE providers (id TEXT PRIMARY KEY, name TEXT NOT NULL, website TEXT, contact TEXT, baseCurrency TEXT, usdRate TEXT, eurRate TEXT, notes TEXT)`)
    sqlite.exec(`CREATE TABLE provider_accounts (id TEXT PRIMARY KEY, providerId TEXT NOT NULL, name TEXT NOT NULL, panelUrl TEXT, currency TEXT, billingMode TEXT, notes TEXT, apiType TEXT, apiBaseUrl TEXT, apiCredentials TEXT)`)
    sqlite.exec(`INSERT INTO providers (id, name) VALUES ('p1', 'Host')`)
    sqlite.exec(`INSERT INTO provider_accounts (id, providerId, name, apiType, apiBaseUrl, apiCredentials) VALUES ('a1', 'p1', 'Acc', 'billmanager', 'https://bm.test/billmgr', 'u:p')`)

    resetRuntimeMigrate()
    ensureRuntimeSchema(sqlite)

    expect(sqlite.prepare(`SELECT apiType, apiBaseUrl, spaceId FROM providers`).get()).toEqual({
      apiType: 'billmanager',
      apiBaseUrl: 'https://bm.test/billmgr',
      spaceId: 'space-main',
    })
    expect(sqlite.prepare(`SELECT apiCredentials FROM provider_accounts`).get()).toEqual({ apiCredentials: 'u:p' })
  })
})
