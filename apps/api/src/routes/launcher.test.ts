import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { closeDb } from '@cfdm/db'
import { resetTestDb } from '@cfdm/db/test-setup'
import { buildApp } from '../index.js'

describe('GET /cc launcher', () => {
  let app: Awaited<ReturnType<typeof buildApp>>

  beforeEach(async () => {
    process.env.CENSORCHECK_INGEST_SECRET = 'launcher-secret-key'
    process.env.CENSORCHECK_PUBLIC_URL = 'https://vt.shnt.top'
    process.env.CENSORCHECK_RATE_LIMIT = '0'
    resetTestDb()
    app = await buildApp()
  })

  afterEach(async () => {
    await app.close()
    closeDb()
  })

  it('отдаёт bash-скрипт с токеном и no-store', async () => {
    const res = await app.inject({ method: 'GET', url: '/cc' })
    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toMatch(/text\/plain/)
    expect(res.headers['cache-control']).toMatch(/no-store/)
    expect(res.body).toContain('https://vt.shnt.top')
    expect(res.body).toContain('VT_INGEST_TOKEN')
    expect(res.body).not.toContain('__VT_API_URL__')
    expect(res.body).not.toContain('__VT_INGEST_TOKEN__')
  })

  it('отдаёт vendor-скрипт', async () => {
    const res = await app.inject({ method: 'GET', url: '/cc/vendor' })
    expect(res.statusCode).toBe(200)
    expect(res.body).toContain('#!/usr/bin/env bash')
    expect(res.body).toContain('SCRIPT_NAME')
  })
})
