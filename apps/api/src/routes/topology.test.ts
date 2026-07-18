import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { closeDb } from '@cfdm/db'
import { resetTestDb } from '@cfdm/db/test-setup'
import { topologyRepository } from '@cfdm/db/repositories/topology'
import { buildApp } from '../index.js'

describe('topology routes', () => {
  let app: Awaited<ReturnType<typeof buildApp>>

  beforeEach(async () => {
    resetTestDb()
    app = await buildApp()
  })

  afterEach(async () => {
    await app.close()
    closeDb()
  })

  it('lists empty diagrams', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/topology' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual([])
  })

  it('creates and gets diagram', async () => {
    const create = await app.inject({
      method: 'POST',
      url: '/api/topology',
      payload: { name: 'Мастер' },
    })
    expect(create.statusCode).toBe(201)
    const created = create.json() as { id: string; name: string; document: unknown }
    expect(created.name).toBe('Мастер')
    expect(created.document).toMatchObject({
      nodes: [],
      edges: [],
      viewport: { x: 0, y: 0, zoom: 1 },
    })

    const get = await app.inject({
      method: 'GET',
      url: `/api/topology/${created.id}`,
    })
    expect(get.statusCode).toBe(200)
    expect(get.json()).toMatchObject({ id: created.id, name: 'Мастер' })
  })

  it('updates document and returns 409 on stale expectedUpdatedAt', async () => {
    const diagram = topologyRepository.create({ name: 'Схема 1' })
    const put = await app.inject({
      method: 'PUT',
      url: `/api/topology/${diagram.id}`,
      payload: {
        document: {
          nodes: [{ id: 'n1', position: { x: 0, y: 0 }, data: {} }],
          edges: [],
          viewport: { x: 0, y: 0, zoom: 1.2 },
        },
        expectedUpdatedAt: diagram.updatedAt,
      },
    })
    expect(put.statusCode).toBe(200)
    const updated = put.json() as { updatedAt: string; document: { nodes: unknown[] } }
    expect(updated.document.nodes).toHaveLength(1)

    const stale = await app.inject({
      method: 'PUT',
      url: `/api/topology/${diagram.id}`,
      payload: {
        name: 'Stale',
        expectedUpdatedAt: diagram.updatedAt,
      },
    })
    expect(stale.statusCode).toBe(409)
  })

  it('deletes diagram', async () => {
    const diagram = topologyRepository.create({ name: 'Delete me' })
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/topology/${diagram.id}`,
    })
    expect(res.statusCode).toBe(204)
    expect(topologyRepository.get(diagram.id)).toBeUndefined()
  })
})
