import { Router } from 'express'
import { getDb } from '../db.js'
import { resolveOrCreateProject } from '../projects-service.js'

const router = Router()

function projectColumnsForSave(db, projectInput) {
  const resolved = resolveOrCreateProject(db, projectInput)
  if (!resolved.id) {
    return { project: '', projectId: '' }
  }
  return { project: resolved.name, projectId: resolved.id }
}

export function rowToVps(row) {
  if (!row) return null
  let additionalIps = []
  try {
    additionalIps = row.additionalIps ? JSON.parse(row.additionalIps) : []
  } catch {
    additionalIps = []
  }
  let userOverrides = []
  try {
    userOverrides = row.userOverrides ? JSON.parse(row.userOverrides) : []
  } catch {
    userOverrides = []
  }
  return {
    ...row,
    additionalIps,
    userOverrides,
    projectId: row.projectId ?? '',
    monitoringEnabled: Boolean(row.monitoringEnabled),
    backupEnabled: Boolean(row.backupEnabled),
    dailyRate: row.dailyRate != null ? row.dailyRate : '',
    monthlyRate: row.monthlyRate != null ? row.monthlyRate : '',
  }
}

router.get('/', (req, res) => {
  try {
    const db = getDb()
    const rows = db.prepare('SELECT * FROM vps ORDER BY createdAt DESC').all()
    res.json(rows.map(rowToVps))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/', (req, res) => {
  try {
    const db = getDb()
    const r = req.body
    const id = r.id || `vps-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
    const additionalIps = Array.isArray(r.additionalIps) ? JSON.stringify(r.additionalIps) : '[]'
    const dailyRate = r.dailyRate === '' || r.dailyRate == null ? null : Number(r.dailyRate)
    const monthlyRate = r.monthlyRate === '' || r.monthlyRate == null ? null : Number(r.monthlyRate)
    const { project, projectId } = projectColumnsForSave(db, r.project)

    db.prepare(`
      INSERT INTO vps (
        id, ip, ipv6, additionalIps, dns, providerId, providerAccountId, country, city, datacenter,
        os, vcpu, ramGb, diskGb, diskType, virtualization, bandwidthTb, sshPort, rootUser,
        purpose, environment, project, projectId, monitoringEnabled, backupEnabled, status, tariffType,
        currency, dailyRate, monthlyRate, createdAt, paidUntil, notes, userOverrides
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      r.ip ?? '',
      r.ipv6 ?? '',
      additionalIps,
      r.dns ?? '',
      r.providerId ?? '',
      r.providerAccountId ?? '',
      r.country ?? '',
      r.city ?? '',
      r.datacenter ?? '',
      r.os ?? '',
      r.vcpu ?? 0,
      r.ramGb ?? 0,
      r.diskGb ?? 0,
      r.diskType ?? '',
      r.virtualization ?? '',
      r.bandwidthTb ?? 0,
      r.sshPort ?? 22,
      r.rootUser ?? '',
      r.purpose ?? '',
      r.environment ?? '',
      project,
      projectId || null,
      r.monitoringEnabled ? 1 : 0,
      r.backupEnabled ? 1 : 0,
      r.status ?? 'active',
      r.tariffType ?? '',
      r.currency ?? '',
      dailyRate,
      monthlyRate,
      r.createdAt ?? new Date().toISOString().slice(0, 10),
      r.paidUntil ?? '',
      r.notes ?? '',
      r.userOverrides ? (Array.isArray(r.userOverrides) ? JSON.stringify(r.userOverrides) : r.userOverrides) : '[]',
    )
    const row = db.prepare('SELECT * FROM vps WHERE id = ?').get(id)
    res.status(201).json(rowToVps(row))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

const USER_OVERRIDABLE_FIELDS = ['country', 'city', 'datacenter', 'os', 'vcpu', 'ramGb', 'diskGb', 'diskType', 'virtualization', 'purpose', 'environment', 'project', 'notes', 'sshPort', 'rootUser', 'bandwidthTb', 'monitoringEnabled', 'backupEnabled']

router.put('/:id', (req, res) => {
  try {
    const db = getDb()
    const { id } = req.params
    const r = req.body
    const existing = db.prepare('SELECT * FROM vps WHERE id = ?').get(id)
    if (!existing) return res.status(404).json({ error: 'Not found' })

    let userOverrides = []
    try {
      userOverrides = existing.userOverrides ? JSON.parse(existing.userOverrides) : []
    } catch {
      userOverrides = []
    }
    const clearOverrides =
      r.userOverrides === 'clear' || (Array.isArray(r.userOverrides) && r.userOverrides.length === 0)
    if (clearOverrides) {
      userOverrides = []
    }

    const additionalIps = Array.isArray(r.additionalIps) ? JSON.stringify(r.additionalIps) : '[]'
    const dailyRate = r.dailyRate === '' || r.dailyRate == null ? null : Number(r.dailyRate)
    const monthlyRate = r.monthlyRate === '' || r.monthlyRate == null ? null : Number(r.monthlyRate)

    let projectOut = existing.project ?? ''
    let projectIdOut = existing.projectId ?? ''
    if (r.project !== undefined) {
      const resolved = projectColumnsForSave(db, r.project)
      projectOut = resolved.project
      projectIdOut = resolved.projectId
    } else if (r.projectId !== undefined) {
      if (!r.projectId) {
        projectOut = ''
        projectIdOut = ''
      } else {
        const prow = db.prepare('SELECT name FROM server_projects WHERE id = ?').get(r.projectId)
        projectOut = prow?.name ?? ''
        projectIdOut = r.projectId
      }
    }

    if (!clearOverrides) {
      for (const f of USER_OVERRIDABLE_FIELDS) {
        if (f === 'project') {
          const projectChanged =
            String(projectOut ?? '') !== String(existing.project ?? '') ||
            String(projectIdOut ?? '') !== String(existing.projectId ?? '')
          if (projectChanged && !userOverrides.includes('project')) {
            userOverrides.push('project')
          }
          continue
        }
        const newVal = r[f]
        const oldVal = existing[f]
        const changed = String(newVal ?? '') !== String(oldVal ?? '')
        if (changed && !userOverrides.includes(f)) {
          userOverrides.push(f)
        }
      }
    }
    const userOverridesJson = JSON.stringify([...new Set(userOverrides)])

    db.prepare(`
      UPDATE vps SET
        ip = ?, ipv6 = ?, additionalIps = ?, dns = ?, providerId = ?, providerAccountId = ?,
        country = ?, city = ?, datacenter = ?, os = ?, vcpu = ?, ramGb = ?, diskGb = ?, diskType = ?,
        virtualization = ?, bandwidthTb = ?, sshPort = ?, rootUser = ?, purpose = ?, environment = ?,
        project = ?, projectId = ?, monitoringEnabled = ?, backupEnabled = ?, status = ?, tariffType = ?,
        currency = ?, dailyRate = ?, monthlyRate = ?, createdAt = ?, paidUntil = ?, notes = ?,
        userOverrides = ?
      WHERE id = ?
    `).run(
      r.ip ?? '',
      r.ipv6 ?? '',
      additionalIps,
      r.dns ?? '',
      r.providerId ?? '',
      r.providerAccountId ?? '',
      r.country ?? '',
      r.city ?? '',
      r.datacenter ?? '',
      r.os ?? '',
      r.vcpu ?? 0,
      r.ramGb ?? 0,
      r.diskGb ?? 0,
      r.diskType ?? '',
      r.virtualization ?? '',
      r.bandwidthTb ?? 0,
      r.sshPort ?? 22,
      r.rootUser ?? '',
      r.purpose ?? '',
      r.environment ?? '',
      projectOut,
      projectIdOut || null,
      r.monitoringEnabled ? 1 : 0,
      r.backupEnabled ? 1 : 0,
      r.status ?? 'active',
      r.tariffType ?? '',
      r.currency ?? '',
      dailyRate,
      monthlyRate,
      r.createdAt ?? '',
      r.paidUntil ?? '',
      r.notes ?? '',
      userOverridesJson,
      id,
    )
    const row = db.prepare('SELECT * FROM vps WHERE id = ?').get(id)
    if (!row) return res.status(404).json({ error: 'Not found' })
    res.json(rowToVps(row))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.delete('/:id', (req, res) => {
  try {
    const db = getDb()
    const { id } = req.params
    const result = db.prepare('DELETE FROM vps WHERE id = ?').run(id)
    if (result.changes === 0) return res.status(404).json({ error: 'Not found' })
    res.status(204).send()
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.patch('/bulk', (req, res) => {
  try {
    const db = getDb()
    const { ids = [], action, value } = req.body
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'ids must be a non-empty array' })
    }
    if (action === 'status' && value) {
      const validStatus = ['active', 'paused', 'archived']
      if (!validStatus.includes(value)) {
        return res.status(400).json({ error: 'value must be active, paused, or archived' })
      }
      const stmt = db.prepare('UPDATE vps SET status = ? WHERE id = ?')
      for (const id of ids) {
        stmt.run(value, id)
      }
      return res.json({ updated: ids.length, status: value })
    }
    if (action === 'delete') {
      const stmt = db.prepare('DELETE FROM vps WHERE id = ?')
      let deleted = 0
      for (const id of ids) {
        const result = stmt.run(id)
        if (result.changes > 0) deleted++
      }
      return res.json({ deleted })
    }
    if (action === 'project') {
      const projectValue = value == null ? '' : String(value)
      const { project: projName, projectId: projId } = projectColumnsForSave(db, projectValue)
      const getStmt = db.prepare('SELECT * FROM vps WHERE id = ?')
      const updStmt = db.prepare(
        'UPDATE vps SET project = ?, projectId = ?, userOverrides = ? WHERE id = ?',
      )
      let updated = 0
      for (const id of ids) {
        const existing = getStmt.get(id)
        if (!existing) continue
        if (
          String(existing.project ?? '') === projName &&
          String(existing.projectId ?? '') === String(projId ?? '')
        ) {
          continue
        }
        let userOverrides = []
        try {
          userOverrides = existing.userOverrides ? JSON.parse(existing.userOverrides) : []
        } catch {
          userOverrides = []
        }
        if (!userOverrides.includes('project')) {
          userOverrides.push('project')
        }
        updStmt.run(projName, projId || null, JSON.stringify([...new Set(userOverrides)]), id)
        updated++
      }
      return res.json({ updated, project: projName, projectId: projId })
    }
    return res.status(400).json({ error: 'action must be status, delete, or project' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
