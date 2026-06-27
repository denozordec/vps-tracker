import Database from 'better-sqlite3'
import { join } from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const dbPath = join(root, 'data', 'vps-tracker.db')
const db = new Database(dbPath, { readonly: true })

console.log('path:', dbPath)
console.log('integrity_check:', db.pragma('integrity_check', { simple: true }))

const tables = db
  .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
  .all()
console.log('tables:', tables.map((t) => t.name).join(', '))

for (const t of [
  'providers',
  'provider_accounts',
  'vps',
  'payments',
  'settings',
  'sync_log',
  'active_tariffs',
]) {
  try {
    const r = db.prepare(`SELECT COUNT(*) as c FROM ${t}`).get()
    console.log(`${t}:`, r.c)
  } catch (e) {
    console.log(`${t}: ERROR`, e.message)
  }
}

db.close()
