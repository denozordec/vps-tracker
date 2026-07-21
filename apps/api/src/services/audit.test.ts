import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { closeDb } from '@cfdm/db'
import { auditLogRepository } from '@cfdm/db/repositories/audit-log'
import { resetTestDb } from '@cfdm/db/test-setup'
import {
  auditCreate,
  loadAuditIngestConfig,
  pushAuditToPortal,
} from './audit.js'

describe('audit dual-write', () => {
  beforeEach(() => {
    resetTestDb()
    process.env.AUTH_PORTAL_URL = 'http://portal.test'
    process.env.AUTH_AUDIT_INGEST_SECRET = 'test-ingest-secret'
    process.env.NODE_ENV = 'test'
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    closeDb()
  })

  it('writes eventId and actorUserId locally', () => {
    auditCreate(
      'vps',
      'vps-1',
      { ip: '1.2.3.4' },
      {
        actorUserId: 'user-42',
        actorEmail: 'u@test.local',
        actorName: 'User',
        ip: '10.0.0.1',
      },
    )

    const rows = auditLogRepository.list(10)
    expect(rows).toHaveLength(1)
    expect(rows[0]?.entity).toBe('vps')
    expect(rows[0]?.entityId).toBe('vps-1')
    expect(rows[0]?.action).toBe('create')
    expect(rows[0]?.actorUserId).toBe('user-42')
    expect(rows[0]?.eventId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    )
  })

  it('fire-and-forgets portal ingest with vps action key', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ accepted: 1, duplicates: 0 })))
    vi.stubGlobal('fetch', fetchMock)

    auditCreate(
      'vps',
      'vps-2',
      { status: 'active' },
      {
        actorUserId: 'user-7',
        actorEmail: 'actor@test.local',
        actorName: 'Actor',
        ip: null,
      },
    )

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('http://portal.test/api/v1/ingest/audit')
    expect(init.method).toBe('POST')
    expect(init.headers).toMatchObject({
      Authorization: 'Bearer test-ingest-secret',
      'Content-Type': 'application/json',
    })

    const body = JSON.parse(String(init.body)) as {
      events: Array<{
        event_id: string
        source_app: string
        action: string
        actor_user_id: string
        target_type: string
        target_id: string
        summary: string
      }>
    }
    expect(body.events).toHaveLength(1)
    expect(body.events[0]?.source_app).toBe('vps')
    expect(body.events[0]?.action).toBe('vps.vps.create')
    expect(body.events[0]?.actor_user_id).toBe('user-7')
    expect(body.events[0]?.target_type).toBe('app_resource')
    expect(body.events[0]?.target_id).toBe('vps-2')
    expect(body.events[0]?.summary).toContain('VPS')
  })

  it('does not throw when portal ingest fails', () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('network down')
      }),
    )

    expect(() =>
      pushAuditToPortal({
        eventId: 'evt-1',
        entity: 'vps',
        entityId: 'vps-3',
        op: 'delete',
        ctx: {
          actorUserId: null,
          actorEmail: null,
          actorName: null,
          ip: null,
        },
        createdAt: new Date().toISOString(),
      }),
    ).not.toThrow()
  })

  it('skips portal push when ingest secret is unset in production', () => {
    process.env.NODE_ENV = 'production'
    delete process.env.AUTH_AUDIT_INGEST_SECRET

    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    pushAuditToPortal({
      eventId: 'evt-2',
      entity: 'vps',
      entityId: 'vps-4',
      op: 'update',
      diff: { ip: '9.9.9.9' },
      createdAt: new Date().toISOString(),
    })

    expect(fetchMock).not.toHaveBeenCalled()
    expect(loadAuditIngestConfig().ingestSecret).toBeUndefined()
  })
})
