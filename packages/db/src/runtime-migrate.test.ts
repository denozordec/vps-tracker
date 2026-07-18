import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { closeDb, getDb, getSqlite } from './index.js'
import { resetRuntimeMigrate } from './runtime-migrate.js'
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
