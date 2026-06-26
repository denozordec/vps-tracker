/**
 * Справочник проектов (пулов): поиск без учёта регистра, автосоздание, подсказки.
 */

import { randomUUID } from 'node:crypto'

/**
 * @param {unknown} name
 * @returns {string}
 */
export function normalizeProjectNameInput(name) {
  if (name == null) return ''
  return String(name).trim()
}

/**
 * @param {ReturnType<import('./db.js').getDb>} db
 * @param {string} name — уже нормализованное имя (trim)
 * @returns {{ id: string, name: string, color?: string, sortOrder?: number, notes?: string, createdAt?: string } | null}
 */
export function findProjectByNameCaseInsensitive(db, name) {
  const n = normalizeProjectNameInput(name)
  if (!n) return null
  return db
    .prepare(
      `SELECT * FROM server_projects WHERE LOWER(name) = LOWER(?) LIMIT 1`,
    )
    .get(n)
}

/**
 * Найти существующий проект или создать новую строку.
 * @param {ReturnType<import('./db.js').getDb>} db
 * @param {string} name
 * @returns {{ id: string | null, name: string }}
 */
export function resolveOrCreateProject(db, name) {
  const n = normalizeProjectNameInput(name)
  if (!n) return { id: null, name: '' }
  const existing = findProjectByNameCaseInsensitive(db, n)
  if (existing) {
    return { id: existing.id, name: existing.name }
  }
  const id = `proj-${randomUUID()}`
  const now = new Date().toISOString()
  db.prepare(
    `INSERT INTO server_projects (id, name, color, sortOrder, notes, createdAt) VALUES (?, ?, ?, 0, ?, ?)`,
  ).run(id, n, null, null, now)
  return { id, name: n }
}

/**
 * @param {ReturnType<import('./db.js').getDb>} db
 * @param {string} q
 * @param {number} limit
 * @returns {{ id: string, name: string }[]}
 */
export function projectSuggestions(db, q, limit = 20) {
  const term = normalizeProjectNameInput(q)
  const lim = Math.min(50, Math.max(1, Number(limit) || 20))
  if (!term) {
    return db
      .prepare(`SELECT id, name FROM server_projects ORDER BY name LIMIT ?`)
      .all(lim)
  }
  const esc = term.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')
  const pattern = `%${esc.toLowerCase()}%`
  return db
    .prepare(
      `SELECT id, name FROM server_projects WHERE LOWER(name) LIKE ? ESCAPE '\\' ORDER BY name LIMIT ?`,
    )
    .all(pattern, lim)
}
