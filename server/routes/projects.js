import { Router } from 'express'
import { getDb } from '../db.js'
import {
  normalizeProjectNameInput,
  projectSuggestions,
  resolveOrCreateProject,
} from '../projects-service.js'

const router = Router()

router.get('/', (req, res) => {
  try {
    const db = getDb()
    const rows = db
      .prepare('SELECT id, name, color, sortOrder, notes, createdAt FROM server_projects ORDER BY name')
      .all()
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.get('/suggest', (req, res) => {
  try {
    const db = getDb()
    const q = req.query.q ?? ''
    const limit = req.query.limit != null ? Number(req.query.limit) : 20
    const rows = projectSuggestions(db, q, limit)
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/resolve-or-create', (req, res) => {
  try {
    const db = getDb()
    const name = req.body?.name
    const resolved = resolveOrCreateProject(db, name)
    res.json(resolved)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/', (req, res) => {
  try {
    const db = getDb()
    const name = normalizeProjectNameInput(req.body?.name)
    if (!name) {
      return res.status(400).json({ error: 'name is required' })
    }
    const resolved = resolveOrCreateProject(db, name)
    res.status(201).json(resolved)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
