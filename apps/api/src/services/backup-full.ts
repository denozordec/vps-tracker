import { getDb, getSqlite, schema } from '@cfdm/db'
import {
  spacesRepository,
  vpsGrantsRepository,
} from '@cfdm/db/repositories/spaces'

const TABLE_ORDER_DELETE = [
  'vps_grants',
  'notification_log',
  'notification_state',
  'vps_health_checks',
  'audit_log',
  'sync_log',
  'active_tariffs',
  'tariff_sync_options',
  'topology_diagrams',
  'vps_domains',
  'balance_ledger',
  'payments',
  'vps',
  'provider_accounts',
  'server_projects',
  'providers',
  'settings',
  'space_members',
  'spaces',
] as const

const TABLE_ORDER_INSERT = [...TABLE_ORDER_DELETE].reverse()

export const FULL_BACKUP_VERSION = 2

export type FullBackupPayload = {
  backupVersion?: number
  exportedAt?: string
  tables?: Record<string, Record<string, unknown>[]>
  /** Legacy v1 fields — ignored when tables present */
  [key: string]: unknown
}

function selectAll(table: string): Record<string, unknown>[] {
  const sqlite = getSqlite()
  try {
    return sqlite.prepare(`SELECT * FROM ${table}`).all() as Record<string, unknown>[]
  } catch {
    return []
  }
}

/** Full multi-space dump for backup export. */
export function getFullBackupSnapshot(): FullBackupPayload {
  const tables: Record<string, Record<string, unknown>[]> = {}
  for (const table of TABLE_ORDER_INSERT) {
    tables[table] = selectAll(table)
  }
  return {
    backupVersion: FULL_BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    tables,
  }
}

function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`
}

function insertRows(table: string, rows: Record<string, unknown>[]): void {
  if (!rows.length) return
  const sqlite = getSqlite()
  const cols = Object.keys(rows[0]!)
  const placeholders = cols.map(() => '?').join(', ')
  const colList = cols.map(quoteIdent).join(', ')
  const stmt = sqlite.prepare(
    `INSERT INTO ${table} (${colList}) VALUES (${placeholders})`,
  )
  for (const row of rows) {
    stmt.run(...cols.map((c) => row[c] ?? null))
  }
}

/**
 * Full overwrite import (v2 tables dump).
 * Falls back to legacy importJsonSnapshot when `tables` missing.
 */
export function importFullBackup(data: FullBackupPayload): void {
  const tables = data.tables
  if (!tables || typeof tables !== 'object') {
    throw new Error('FULL_BACKUP_REQUIRED')
  }

  const sqlite = getSqlite()
  sqlite.exec('BEGIN')
  try {
    sqlite.pragma('foreign_keys = OFF')
    for (const table of TABLE_ORDER_DELETE) {
      try {
        sqlite.exec(`DELETE FROM ${table}`)
      } catch {
        /* missing table */
      }
    }

    for (const table of TABLE_ORDER_INSERT) {
      const rows = Array.isArray(tables[table]) ? tables[table]! : []
      insertRows(table, rows)
    }

    sqlite.pragma('foreign_keys = ON')
    sqlite.exec('COMMIT')
  } catch (err) {
    sqlite.exec('ROLLBACK')
    sqlite.pragma('foreign_keys = ON')
    throw err
  }

  // Ensure main space exists after import
  spacesRepository.getMain()
}

export function listAllSpaceMembers(): typeof schema.spaceMembers.$inferSelect[] {
  return getDb().select().from(schema.spaceMembers).all()
}

export function listAllSpaces() {
  return spacesRepository.listAll({ includeDeleted: true })
}

export function listAllGrants() {
  return vpsGrantsRepository.listAll()
}
