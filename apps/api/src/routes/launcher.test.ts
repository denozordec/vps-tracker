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
    expect(res.body).toContain('ensure_cmds jq dig column')
    expect(res.body).toContain('detect_os')
    expect(res.body).toContain('detect_hoster')
    expect(res.body).toContain('ipwho.is')
    expect(res.body).toContain('/etc/os-release')
    expect(res.body).toContain('apt-get install -y -qq')
    expect(res.body).toContain('Проверяю сайты')
    expect(res.body).toContain('--daily')
    expect(res.body).toContain('--remove-daily')
    expect(res.body).toContain('DAILY_SLUG="vt-censorcheck"')
    expect(res.body).toContain('vps-tracker:${DAILY_SLUG}')
    expect(res.body).toContain('/etc/cron.d')
    expect(res.body).not.toContain('2>/tmp/vt-censorcheck-err')
    expect(res.body).not.toContain('\r')
    expect(res.body).not.toContain('__VT_API_URL__')
    expect(res.body).not.toContain('__VT_INGEST_TOKEN__')
  })

  it('отдаёт vendor-скрипт', async () => {
    const res = await app.inject({ method: 'GET', url: '/cc/vendor' })
    expect(res.statusCode).toBe(200)
    expect(res.body).toContain('#!/usr/bin/env bash')
    expect(res.body).toContain('SCRIPT_NAME')
    expect(res.body).toContain('is_installed()')
    expect(res.body).toContain('cat <<EOF')
    expect(res.body).toContain('JSON на stdout не ломаем')
    expect(res.body).not.toContain('\r')
  })
})

describe('GET /ic launcher', () => {
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
    const res = await app.inject({ method: 'GET', url: '/ic' })
    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toMatch(/text\/plain/)
    expect(res.headers['cache-control']).toMatch(/no-store/)
    expect(res.body).toContain('https://vt.shnt.top')
    expect(res.body).toContain('VT_INGEST_TOKEN')
    expect(res.body).toContain('ensure_cmds jq dig column nslookup')
    expect(res.body).toContain('detect_hoster')
    expect(res.body).toContain('--json --ipv4')
    expect(res.body).toContain('/api/integrations/ipregion/runs')
    expect(res.body).toContain('/ic/vendor')
    expect(res.body).toContain('7d1c25c')
    expect(res.body).toContain('--daily')
    expect(res.body).toContain('--remove-daily')
    expect(res.body).toContain('DAILY_SLUG="vt-ipregion"')
    expect(res.body).toContain('vps-tracker:${DAILY_SLUG}')
    expect(res.body).not.toContain('\r')
    expect(res.body).not.toContain('__VT_API_URL__')
    expect(res.body).not.toContain('__VT_INGEST_TOKEN__')
  })

  it('отдаёт vendor-скрипт ipregion', async () => {
    const res = await app.inject({ method: 'GET', url: '/ic/vendor' })
    expect(res.statusCode).toBe(200)
    expect(res.body).toContain('#!/usr/bin/env bash')
    expect(res.body).toContain('SCRIPT_NAME="ipregion.sh"')
    expect(res.body).toContain('finalize_json')
    expect(res.body).not.toContain('\r')
  })
})

describe('GET /cc.rsc RouterOS launcher', () => {
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

  it('отдаёт .rsc с токеном и no-store', async () => {
    const res = await app.inject({ method: 'GET', url: '/cc.rsc' })
    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toMatch(/text\/plain/)
    expect(res.headers['cache-control']).toMatch(/no-store/)
    expect(res.body).toContain('https://vt.shnt.top')
    expect(res.body).toContain('/tool fetch')
    expect(res.body).toContain('/api/integrations/censorcheck/runs')
    expect(res.body).toContain('ros-2')
    expect(res.body).toContain(':local vtDaily "no"')
    expect(res.body).toContain(':local vtRemove "no"')
    expect(res.body).toContain('/system scheduler')
    expect(res.body).toContain('youtube.com')
    expect(res.body).toContain(':global vtIface')
    expect(res.body).toContain('src-address=$srcIp')
    expect(res.body).not.toContain('\r')
    expect(res.body).not.toContain('__VT_API_URL__')
    expect(res.body).not.toContain('__VT_INGEST_TOKEN__')
    expect(res.body).not.toContain('__VT_DAILY__')
    expect(res.body).not.toContain('__VT_REMOVE_DAILY__')
  })

  it('?daily=1 включает установку scheduler', async () => {
    const res = await app.inject({ method: 'GET', url: '/cc.rsc?daily=1' })
    expect(res.statusCode).toBe(200)
    expect(res.body).toContain(':local vtDaily "yes"')
    expect(res.body).toContain(':local vtRemove "no"')
    expect(res.body).toContain('/system scheduler add')
  })

  it('?remove=daily снимает scheduler без проб', async () => {
    const res = await app.inject({ method: 'GET', url: '/cc.rsc?remove=daily' })
    expect(res.statusCode).toBe(200)
    expect(res.body).toContain(':local vtRemove "yes"')
    expect(res.body).toContain(':local vtDaily "no"')
    expect(res.body).toContain('Ежедневная проверка снята')
  })
})

describe('GET /ic.rsc RouterOS launcher', () => {
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

  it('отдаёт .rsc с токеном и no-store', async () => {
    const res = await app.inject({ method: 'GET', url: '/ic.rsc' })
    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toMatch(/text\/plain/)
    expect(res.headers['cache-control']).toMatch(/no-store/)
    expect(res.body).toContain('https://vt.shnt.top')
    expect(res.body).toContain('/tool fetch')
    expect(res.body).toContain('/api/integrations/ipregion/runs')
    expect(res.body).toContain('ros-2')
    expect(res.body).toContain(':local vtDaily "no"')
    expect(res.body).toContain('ipinfo.io')
    expect(res.body).toContain('cloudflare cdn')
    expect(res.body).toContain(':global vtIface')
    expect(res.body).toContain('src-address=$srcIp')
    expect(res.body).not.toContain('\r')
    expect(res.body).not.toContain('__VT_API_URL__')
    expect(res.body).not.toContain('__VT_INGEST_TOKEN__')
  })

  it('?daily=1 включает установку scheduler', async () => {
    const res = await app.inject({ method: 'GET', url: '/ic.rsc?daily=1' })
    expect(res.statusCode).toBe(200)
    expect(res.body).toContain(':local vtDaily "yes"')
    expect(res.body).toContain('/system scheduler add')
  })
})

describe('GET /cc.rsc without ingest secret', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  const prevNodeEnv = process.env.NODE_ENV
  const prevAuthRequired = process.env.AUTH_REQUIRED
  const prevCc = process.env.CENSORCHECK_INGEST_SECRET
  const prevAuth = process.env.AUTH_JWT_SECRET
  const prevJwt = process.env.JWT_SECRET

  beforeEach(async () => {
    process.env.NODE_ENV = 'production'
    process.env.AUTH_REQUIRED = 'false'
    delete process.env.CENSORCHECK_INGEST_SECRET
    delete process.env.AUTH_JWT_SECRET
    delete process.env.JWT_SECRET
    process.env.CENSORCHECK_RATE_LIMIT = '0'
    resetTestDb()
    app = await buildApp()
  })

  afterEach(async () => {
    await app.close()
    closeDb()
    process.env.NODE_ENV = prevNodeEnv
    if (prevAuthRequired === undefined) delete process.env.AUTH_REQUIRED
    else process.env.AUTH_REQUIRED = prevAuthRequired
    if (prevCc === undefined) delete process.env.CENSORCHECK_INGEST_SECRET
    else process.env.CENSORCHECK_INGEST_SECRET = prevCc
    if (prevAuth === undefined) delete process.env.AUTH_JWT_SECRET
    else process.env.AUTH_JWT_SECRET = prevAuth
    if (prevJwt === undefined) delete process.env.JWT_SECRET
    else process.env.JWT_SECRET = prevJwt
  })

  it('отвечает 503', async () => {
    const res = await app.inject({ method: 'GET', url: '/cc.rsc' })
    expect(res.statusCode).toBe(503)
    expect(res.body).toMatch(/not configured/)
  })
})
