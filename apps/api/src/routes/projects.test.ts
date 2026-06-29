import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { closeDb } from '@cfdm/db'
import { resetTestDb, seedTestProvider, seedTestProviderAccount } from '@cfdm/db/test-setup'
import { projectsRepository } from '@cfdm/db/repositories/projects'
import { getSqlite } from '@cfdm/db'
import { buildApp } from '../index.js'

describe('projects routes', () => {
  let app: Awaited<ReturnType<typeof buildApp>>

  beforeEach(async () => {
    resetTestDb()
    seedTestProvider()
    seedTestProviderAccount()
    app = await buildApp()
  })

  afterEach(async () => {
    await app.close()
    closeDb()
  })

  it('lists projects', async () => {
    projectsRepository.create({ name: 'Alpha', color: '#ff0000' })
    const res = await app.inject({ method: 'GET', url: '/api/projects' })
    expect(res.statusCode).toBe(200)
    const body = res.json() as { id: string; name: string; color?: string }[]
    expect(body).toHaveLength(1)
    expect(body[0]?.name).toBe('Alpha')
    expect(body[0]?.color).toBe('#ff0000')
  })

  it('creates project with color and notes', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/projects',
      payload: { name: 'Web', color: '#3b82f6', notes: 'Production sites' },
    })
    expect(res.statusCode).toBe(201)
    const body = res.json() as { id: string; name: string; color?: string; notes?: string }
    expect(body.name).toBe('Web')
    expect(body.color).toBe('#3b82f6')
    expect(body.notes).toBe('Production sites')
  })

  it('renames project and cascades vps.project', async () => {
    const project = projectsRepository.create({ name: 'OldName' })
    getSqlite()
      .prepare(
        `INSERT INTO vps (id, ip, providerId, providerAccountId, status, project, projectId)
         VALUES ('vps-p1', '1.1.1.1', 'prov-1', 'acc-1', 'active', 'OldName', ?)`,
      )
      .run(project.id)

    const res = await app.inject({
      method: 'PUT',
      url: `/api/projects/${project.id}`,
      payload: { name: 'NewName' },
    })
    expect(res.statusCode).toBe(200)
    const vps = getSqlite().prepare(`SELECT project FROM vps WHERE id = 'vps-p1'`).get() as {
      project: string
    }
    expect(vps.project).toBe('NewName')
  })

  it('returns 409 when deleting project with VPS', async () => {
    const project = projectsRepository.create({ name: 'Bound' })
    getSqlite()
      .prepare(
        `INSERT INTO vps (id, ip, providerId, providerAccountId, status, project, projectId)
         VALUES ('vps-p2', '2.2.2.2', 'prov-1', 'acc-1', 'active', 'Bound', ?)`,
      )
      .run(project.id)

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/projects/${project.id}`,
    })
    expect(res.statusCode).toBe(409)
    const body = res.json() as { error?: { code?: string; dependencies?: { vps?: number } } }
    expect(body.error?.code).toBe('CONFLICT')
    expect(body.error?.dependencies?.vps).toBe(1)
  })

  it('deletes project without dependencies', async () => {
    const project = projectsRepository.create({ name: 'Free' })
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/projects/${project.id}`,
    })
    expect(res.statusCode).toBe(204)
    expect(projectsRepository.get(project.id)).toBeUndefined()
  })
})
