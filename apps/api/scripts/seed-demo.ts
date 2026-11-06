/**
 * Demo data for screenshots/docs. Fictional hosters, IPs from documentation ranges (RFC 5737).
 * Needs an EMPTY database file. VITEST=1 keeps src/index.ts from starting the real server + scheduler.
 *
 *   cd apps/api
 *   DB_PATH=../../data/demo.db VITEST=1 LOG_LEVEL=warn npx tsx scripts/seed-demo.ts --serve
 *
 * With --serve the seeded app keeps listening on PORT (default 3101) for scripts/docs-screenshots.mjs.
 */
import { getSqlite } from '@cfdm/db'
import { buildApp } from '../src/index.js'
import { mintIngestToken } from '../src/services/censorcheck/ingest-token.js'
import { stopScheduler } from '../src/services/scheduler.js'

const SECRET = process.env.CENSORCHECK_INGEST_SECRET || 'demo-secret'
process.env.CENSORCHECK_INGEST_SECRET = SECRET
process.env.CENSORCHECK_RATE_LIMIT = '0'

const app = await buildApp()
const sqlite = getSqlite()

async function api<T = { id: string }>(method: string, url: string, payload?: unknown, headers = {}): Promise<T> {
  const res = await app.inject({ method: method as 'POST', url, payload: payload as object, headers })
  if (res.statusCode >= 300) throw new Error(`${method} ${url} → ${res.statusCode}: ${res.body}`)
  return res.json() as T
}

const day = (offset: number) => {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  return d.toISOString().slice(0, 10)
}

// --- settings
await api('PUT', '/api/settings/settings-main', {
  baseCurrency: 'RUB',
  ratesUrl: 'https://www.cbr-xml-daily.ru/daily_json.js',
  autoConvert: true,
  syncEnabled: false,
  notifyPaymentExpiryEnabled: true,
  notifyLowBalanceEnabled: true,
  notifySyncDigestEnabled: true,
  notifyVpsDownEnabled: true,
  telegramChatId: '-1001234567890',
})

// --- providers & accounts
const providers = [
  { key: 'nord', name: 'Nordhost', website: 'https://nordhost.example', baseCurrency: 'EUR', eurRate: '98.5', usdRate: '91.2', apiType: 'billmanager', apiBaseUrl: 'https://my.nordhost.example/billmgr' },
  { key: 'aurora', name: 'Aurora Cloud', website: 'https://aurora-cloud.example', baseCurrency: 'RUB', apiType: 'billmanager', apiBaseUrl: 'https://billing.aurora-cloud.example/billmgr' },
  { key: 'baltic', name: 'Baltic VDS', website: 'https://balticvds.example', baseCurrency: 'RUB', apiType: 'none', apiBaseUrl: '' },
  { key: 'pixel', name: 'Pixel Hosting', website: 'https://pixelhost.example', baseCurrency: 'USD', usdRate: '91.2', apiType: 'none', apiBaseUrl: '' },
]
const prov: Record<string, string> = {}
for (const p of providers) prov[p.key] = (await api('POST', '/api/providers', p)).id

const accounts = [
  { key: 'nord', providerId: prov.nord, name: 'Nordhost — основной', currency: 'EUR', billingMode: 'monthly', apiCredentials: 'demo:demo', balanceAlertBelow: 20, balance: 46.8, enough: day(38) },
  { key: 'aurora', providerId: prov.aurora, name: 'Aurora — проекты', currency: 'RUB', billingMode: 'daily', apiCredentials: 'demo:demo', balanceAlertBelow: 1500, balance: 1120, enough: day(9) },
  { key: 'baltic', providerId: prov.baltic, name: 'Baltic VDS', currency: 'RUB', billingMode: 'monthly', balance: null, enough: '' },
  { key: 'pixel', providerId: prov.pixel, name: 'Pixel — US', currency: 'USD', billingMode: 'monthly', balance: null, enough: '' },
]
const acc: Record<string, string> = {}
for (const a of accounts) {
  const { key, balance, enough, ...body } = a
  acc[key] = (await api('POST', '/api/provider-accounts', body)).id
  if (balance != null) {
    sqlite
      .prepare(`UPDATE provider_accounts SET balance_api = ?, balance_currency = ?, balance_updated_at = ?, enoughmoneyto = ? WHERE id = ?`)
      .run(balance, a.currency, new Date(Date.now() - 40 * 60_000).toISOString(), enough, acc[key])
  }
}

// --- projects
const projects = [
  { name: 'Сайт и API', color: '#2563eb' },
  { name: 'VPN', color: '#16a34a' },
  { name: 'Мониторинг', color: '#d97706' },
  { name: 'Staging', color: '#9333ea' },
]
for (const p of projects) await api('POST', '/api/projects', p)

// --- VPS
type V = Record<string, unknown> & { key: string }
const vpsList: V[] = [
  { key: 'web1', dns: 'web-1.example.net', ip: '203.0.113.10', ipv6: '2001:db8:10::1', providerId: prov.nord, providerAccountId: acc.nord, country: 'Нидерланды', city: 'Амстердам', datacenter: 'AMS-1', os: 'Debian 12', vcpu: 4, ramGb: 8, diskGb: 120, diskType: 'NVMe', virtualization: 'KVM', project: 'Сайт и API', environment: 'production', purpose: 'Frontend + API', tariffType: 'monthly', currency: 'EUR', monthlyRate: 14.9, paidUntil: day(4), monitoringEnabled: true, backupEnabled: true },
  { key: 'web2', dns: 'web-2.example.net', ip: '203.0.113.11', providerId: prov.nord, providerAccountId: acc.nord, country: 'Германия', city: 'Франкфурт', datacenter: 'FRA-2', os: 'Debian 12', vcpu: 4, ramGb: 8, diskGb: 120, diskType: 'NVMe', virtualization: 'KVM', project: 'Сайт и API', environment: 'production', purpose: 'Frontend + API (HA)', tariffType: 'monthly', currency: 'EUR', monthlyRate: 14.9, paidUntil: day(19), monitoringEnabled: true, backupEnabled: true },
  { key: 'db1', dns: 'db-1.example.net', ip: '203.0.113.20', providerId: prov.nord, providerAccountId: acc.nord, country: 'Нидерланды', city: 'Амстердам', datacenter: 'AMS-1', os: 'Ubuntu 24.04', vcpu: 8, ramGb: 32, diskGb: 480, diskType: 'NVMe', virtualization: 'KVM', project: 'Сайт и API', environment: 'production', purpose: 'PostgreSQL', tariffType: 'monthly', currency: 'EUR', monthlyRate: 39, paidUntil: day(19), monitoringEnabled: true, backupEnabled: true },
  { key: 'vpn1', dns: 'vpn-fi.example.net', ip: '198.51.100.31', providerId: prov.aurora, providerAccountId: acc.aurora, country: 'Финляндия', city: 'Хельсинки', datacenter: 'HEL', os: 'Ubuntu 22.04', vcpu: 1, ramGb: 1, diskGb: 15, diskType: 'SSD', virtualization: 'KVM', project: 'VPN', environment: 'production', purpose: 'WireGuard', tariffType: 'daily', currency: 'RUB', dailyRate: 9.5, paidUntil: '', monitoringEnabled: true },
  { key: 'vpn2', dns: 'vpn-de.example.net', ip: '198.51.100.32', providerId: prov.aurora, providerAccountId: acc.aurora, country: 'Германия', city: 'Нюрнберг', datacenter: 'NUE', os: 'Ubuntu 22.04', vcpu: 1, ramGb: 2, diskGb: 20, diskType: 'SSD', virtualization: 'KVM', project: 'VPN', environment: 'production', purpose: 'WireGuard + Xray', tariffType: 'daily', currency: 'RUB', dailyRate: 12, paidUntil: '', monitoringEnabled: true },
  { key: 'vpn3', dns: 'vpn-kz.example.net', ip: '198.51.100.33', providerId: prov.aurora, providerAccountId: acc.aurora, country: 'Казахстан', city: 'Алматы', datacenter: 'ALA', os: 'Debian 12', vcpu: 1, ramGb: 1, diskGb: 10, diskType: 'SSD', virtualization: 'KVM', project: 'VPN', environment: 'production', purpose: 'Xray', tariffType: 'daily', currency: 'RUB', dailyRate: 7.2, paidUntil: '', monitoringEnabled: true },
  { key: 'mon', dns: 'monitor.example.net', ip: '192.0.2.40', providerId: prov.baltic, providerAccountId: acc.baltic, country: 'Россия', city: 'Москва', datacenter: 'MSK-DC3', os: 'Rocky Linux 9', vcpu: 2, ramGb: 4, diskGb: 60, diskType: 'SSD', virtualization: 'KVM', project: 'Мониторинг', environment: 'production', purpose: 'Grafana + Prometheus', tariffType: 'monthly', currency: 'RUB', monthlyRate: 690, paidUntil: day(2), monitoringEnabled: true, backupEnabled: true },
  { key: 'stage', dns: 'stage.example.net', ip: '192.0.2.41', providerId: prov.baltic, providerAccountId: acc.baltic, country: 'Россия', city: 'Санкт-Петербург', datacenter: 'SPB-1', os: 'Debian 12', vcpu: 2, ramGb: 4, diskGb: 40, diskType: 'SSD', virtualization: 'KVM', project: 'Staging', environment: 'staging', purpose: 'Staging', tariffType: 'monthly', currency: 'RUB', monthlyRate: 450, paidUntil: day(26), monitoringEnabled: false },
  { key: 'us1', dns: 'edge-us.example.net', ip: '192.0.2.50', providerId: prov.pixel, providerAccountId: acc.pixel, country: 'США', city: 'Нью-Йорк', datacenter: 'NYC-3', os: 'Ubuntu 24.04', vcpu: 2, ramGb: 2, diskGb: 50, diskType: 'NVMe', virtualization: 'KVM', project: 'Сайт и API', environment: 'production', purpose: 'Edge / CDN origin', tariffType: 'monthly', currency: 'USD', monthlyRate: 12, paidUntil: day(11), monitoringEnabled: true },
  { key: 'old', dns: 'legacy.example.net', ip: '192.0.2.60', providerId: prov.pixel, providerAccountId: acc.pixel, country: 'США', city: 'Даллас', datacenter: 'DAL-1', os: 'CentOS 7', vcpu: 1, ramGb: 1, diskGb: 25, diskType: 'HDD', virtualization: 'OpenVZ', project: 'Staging', environment: 'staging', purpose: 'Старый сервер', status: 'paused', tariffType: 'monthly', currency: 'USD', monthlyRate: 5, paidUntil: day(-12) },
]
const vps: Record<string, string> = {}
for (const { key, ...body } of vpsList) vps[key] = (await api('POST', '/api/vps', body)).id

// --- payments (6 months) and ledger
for (let m = 5; m >= 0; m--) {
  await api('POST', '/api/payments', { type: 'provider_balance_topup', date: day(-m * 30 - 3), amount: 60 + (m % 2) * 15, currency: 'EUR', providerAccountId: acc.nord, note: 'Пополнение картой' })
  await api('POST', '/api/payments', { type: 'provider_balance_topup', date: day(-m * 30 - 7), amount: 900 + m * 50, currency: 'RUB', providerAccountId: acc.aurora, note: 'СБП' })
  await api('POST', '/api/payments', { type: 'direct_vps_payment', date: day(-m * 30 - 1), amount: 690, currency: 'RUB', providerAccountId: acc.baltic, vpsId: vps.mon, note: 'Продление monitor' })
  await api('POST', '/api/payments', { type: 'direct_vps_payment', date: day(-m * 30 - 10), amount: 12, currency: 'USD', providerAccountId: acc.pixel, vpsId: vps.us1, note: 'Продление edge-us' })
}
await api('POST', '/api/payments', { type: 'direct_vps_payment', date: day(-20), amount: 450, currency: 'RUB', providerAccountId: acc.baltic, vpsId: vps.stage, note: 'Продление staging' })
for (let i = 0; i < 6; i++) {
  await api('POST', '/api/balance-ledger', { type: 'daily_debit', date: day(-i), amount: 28.7, currency: 'RUB', direction: 'debit', providerAccountId: acc.aurora, note: 'Списание за VPN-серверы' })
}
await api('POST', '/api/balance-ledger', { type: 'provider_balance_topup', date: day(-7), amount: 1200, currency: 'RUB', direction: 'credit', providerAccountId: acc.aurora, note: 'Пополнение' })

// --- tariffs from "sync"
const tariffs = [
  ['AMS-1', 'Нидерланды', 'KVM-S', 2, 4, 60, '7.90 EUR'], ['AMS-1', 'Нидерланды', 'KVM-M', 4, 8, 120, '14.90 EUR'],
  ['AMS-1', 'Нидерланды', 'KVM-L', 8, 32, 480, '39.00 EUR'], ['FRA-2', 'Германия', 'KVM-S', 2, 4, 60, '8.50 EUR'],
  ['FRA-2', 'Германия', 'KVM-M', 4, 8, 120, '14.90 EUR'],
] as const
const now = new Date().toISOString()
tariffs.forEach(([dc, country, name, cpu, ram, disk, price], i) =>
  sqlite
    .prepare(
      `INSERT INTO active_tariffs (id, spaceId, providerAccountId, providerId, externalId, datacenterKey, datacenterName, name, desc, vcpu, ramGb, diskGb, diskType, virtualization, channel, location, country, cpuModel, orderAvailable, price, syncedAt)
       VALUES (?, 'space-main', ?, ?, ?, ?, ?, ?, '', ?, ?, ?, 'NVMe', 'KVM', '1 Гбит/с', ?, ?, 'AMD EPYC', 1, ?, ?)`,
    )
    .run(`tariff-demo-${i}`, acc.nord, prov.nord, String(100 + i), dc, dc, name, cpu, ram, disk, dc, country, price, now),
)
;[
  ['VPN-1', 1, 1, 10, '7.20 ₽/день'], ['VPN-2', 1, 2, 20, '12.00 ₽/день'], ['Cloud-4', 4, 8, 80, '39.00 ₽/день'],
].forEach(([name, cpu, ram, disk, price], i) =>
  sqlite
    .prepare(
      `INSERT INTO active_tariffs (id, spaceId, providerAccountId, providerId, externalId, datacenterKey, datacenterName, name, desc, vcpu, ramGb, diskGb, diskType, virtualization, channel, location, country, cpuModel, orderAvailable, price, syncedAt)
       VALUES (?, 'space-main', ?, ?, ?, 'HEL', 'Хельсинки', ?, '', ?, ?, ?, 'SSD', 'KVM', '1 Гбит/с', 'Хельсинки', 'Финляндия', 'Intel Xeon', 1, ?, ?)`,
    )
    .run(`tariff-demo-a${i}`, acc.aurora, prov.aurora, String(200 + i), name, cpu, ram, disk, price, now),
)

// --- sync journal
const syncRows: [string, number, string, number, number, string | null][] = [
  [acc.nord, 35, 'ok', 3, 1, null], [acc.aurora, 36, 'ok', 3, 0, null],
  [acc.nord, 95, 'ok', 3, 0, null], [acc.aurora, 96, 'error', 0, 0, 'HTTP 502 Bad Gateway'],
  [acc.nord, 155, 'ok', 3, 0, null], [acc.aurora, 156, 'ok', 3, 1, null],
]
syncRows.forEach(([accountId, minAgo, status, vpsCount, paymentsCount, error], i) => {
  const started = new Date(Date.now() - minAgo * 60_000)
  sqlite
    .prepare(`INSERT INTO sync_log (id, spaceId, accountId, startedAt, finishedAt, status, vpsCount, paymentsCount, error, summary) VALUES (?, 'space-main', ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(`sync-demo-${i}`, accountId, started.toISOString(), new Date(started.getTime() + 4200).toISOString(), status, vpsCount, paymentsCount, error,
      JSON.stringify(status === 'ok' ? { added: [], updated: i === 0 ? [{ id: vps.web1, label: 'web-1.example.net', fields: ['paidUntil'] }] : [], paymentsAdded: paymentsCount, vpsCount, paymentsCount, tariffsCount: 0 } : { error }))
})

// --- uptime history
const health: Record<string, 'up' | 'down'> = { web1: 'up', web2: 'up', db1: 'up', vpn1: 'up', vpn2: 'down', vpn3: 'up', mon: 'up', us1: 'up' }
for (const [key, status] of Object.entries(health)) {
  for (let i = 0; i < 12; i++) {
    const st = i === 0 ? status : 'up'
    sqlite
      .prepare(`INSERT INTO vps_health_checks (id, spaceId, vpsId, checkedAt, status, latencyMs, error) VALUES (?, 'space-main', ?, ?, ?, ?, ?)`)
      .run(`hc-demo-${key}-${i}`, vps[key], new Date(Date.now() - i * 5 * 60_000).toISOString(), st, st === 'up' ? 20 + ((i * 7) % 40) : null, st === 'down' ? 'timeout' : null)
  }
  sqlite.prepare(`UPDATE vps SET last_health_status = ?, last_health_checked_at = ? WHERE id = ?`).run(status, now, vps[key])
}

// --- notifications journal
;[
  ['payment_expiry', 'telegram', 'sent', 'Истекает оплата (ближайшие 7 дней):\n\n• monitor.example.net (Baltic VDS) — до ' + day(2)],
  ['vps_down', 'telegram', 'sent', 'VPS недоступны:\n\n• vpn-de.example.net'],
  ['low_balance', 'telegram', 'sent', 'Низкий баланс:\n\n• Aurora — проекты: 1120 RUB (порог 1500)'],
  ['sync_digest', 'webhook', 'sent', 'Синхронизация VPS:\n\n✓ Nordhost — основной: изм. 1, платежи +1'],
].forEach(([event, channel, status, message], i) =>
  sqlite
    .prepare(`INSERT INTO notification_log (id, spaceId, event, channel, status, fingerprint, message, payload, createdAt) VALUES (?, 'space-main', ?, ?, ?, '', ?, NULL, ?)`)
    .run(`nlog-demo-${i}`, event, channel, status, message, new Date(Date.now() - (i + 1) * 47 * 60_000).toISOString()),
)

// --- censorcheck (blocking) & ipregion (GeoIP) via the real ingest API
const ccServices: [string, Record<string, number>][] = [
  ['youtube.com', { vpn1: 200, vpn2: 200, vpn3: 200, web1: 200 }],
  ['instagram.com', { vpn1: 200, vpn2: 200, vpn3: 403, web1: 200 }],
  ['chatgpt.com', { vpn1: 200, vpn2: 200, vpn3: 403, web1: 200 }],
  ['discord.com', { vpn1: 200, vpn2: 0, vpn3: 200, web1: 200 }],
  ['x.com', { vpn1: 200, vpn2: 200, vpn3: 200, web1: 200 }],
  ['netflix.com', { vpn1: 302, vpn2: 200, vpn3: 403, web1: 200 }],
  ['spotify.com', { vpn1: 200, vpn2: 200, vpn3: 403, web1: 200 }],
  ['linkedin.com', { vpn1: 200, vpn2: 200, vpn3: 200, web1: 200 }],
]
const auth = () => ({ authorization: `Bearer ${mintIngestToken(SECRET)}` })
let n = 0
for (const key of ['vpn1', 'vpn2', 'vpn3', 'web1']) {
  const ip = vpsList.find((v) => v.key === key)!.ip as string
  n++
  await api('POST', '/api/integrations/censorcheck/runs', {
    schemaVersion: 1,
    runId: `00000000-0000-4000-8000-00000000000${n}`,
    probe: { publicIp: ip },
    launcherVersion: '1',
    censorcheck: { version: '12c5839', mode: 'both' },
    results: ccServices.map(([service, codes]) => ({ service, raw: { https: { ipv4: { status: codes[key] } } } })),
  }, auth())
}
const geo: Record<string, string> = { vpn1: 'FI', vpn2: 'DE', vpn3: 'KZ', web1: 'NL', us1: 'US' }
// Keys from IPREGION_*_SERVICES so the matrix columns line up with the real vernette/ipregion list
const geoServices: [string, string][] = [
  ['maxmind.com', 'primary'], ['rdap.db.ripe.net', 'primary'], ['ipinfo.io', 'primary'], ['cloudflare.com', 'primary'],
  ['ipregistry.co', 'primary'], ['ipapi.co', 'primary'], ['ifconfig.co', 'primary'], ['ip2location.io', 'primary'],
  ['google', 'custom'], ['youtube', 'custom'], ['netflix', 'custom'], ['chatgpt', 'custom'],
  ['cloudflare cdn', 'cdn'], ['youtube cdn', 'cdn'],
]
for (const [key, cc] of Object.entries(geo)) {
  const ip = vpsList.find((v) => v.key === key)!.ip as string
  n++
  await api('POST', '/api/integrations/ipregion/runs', {
    schemaVersion: 1,
    runId: `00000000-0000-4000-9000-0000000000${String(n).padStart(2, '0')}`,
    probe: { publicIp: ip },
    launcherVersion: '1',
    ipregion: { version: '7d1c25c' },
    results: geoServices.map(([service, group], i) => ({
      service,
      group,
      // a few services see the KZ node elsewhere — the kind of mismatch the matrix highlights
      ipv4: key === 'vpn3' && (i === 4 || i === 10) ? 'RU' : key === 'vpn1' && i === 9 ? 'SE' : cc,
      ipv6: key === 'web1' ? cc : null,
    })),
  }, auth())
}

// --- topology diagram
const node = (id: string, x: number, y: number, key: string) => ({
  id,
  type: 'vps',
  position: { x, y },
  data: { vpsId: vps[key] },
})
const edge = (source: string, target: string, relation: string, extra: Record<string, unknown> = {}) => ({
  id: `e-${source}-${target}`,
  source,
  target,
  sourceHandle: 'bottom',
  targetHandle: 'top',
  type: 'topology',
  data: { relation, direction: 'forward', lineStyle: 'solid', ...extra },
})
await api('POST', '/api/topology', {
  name: 'Production',
  document: {
    viewport: { x: 0, y: 0, zoom: 1 },
    nodes: [
      { id: 'users', type: 'shape', position: { x: 470, y: 0 }, data: { kind: 'ellipse', label: 'Пользователи' } },
      node('us1', 470, 130, 'us1'),
      node('web1', 220, 290, 'web1'),
      node('web2', 720, 290, 'web2'),
      node('db1', 470, 460, 'db1'),
      node('mon', 970, 460, 'mon'),
      node('vpn1', 120, 640, 'vpn1'),
      node('vpn2', 470, 640, 'vpn2'),
      node('vpn3', 820, 640, 'vpn3'),
      { id: 'note', type: 'note', position: { x: 1120, y: 640 }, data: { text: 'VPN-узлы для команды: WireGuard + Xray' } },
    ],
    edges: [
      edge('users', 'us1', 'network', { label: 'HTTPS' }),
      edge('us1', 'web1', 'network'),
      edge('us1', 'web2', 'network'),
      edge('web1', 'db1', 'dependency', { label: 'PostgreSQL' }),
      edge('web2', 'db1', 'dependency'),
      { ...edge('mon', 'db1', 'dependency', { lineStyle: 'dashed', label: 'метрики' }), sourceHandle: 'left', targetHandle: 'right' },
      { ...edge('vpn1', 'vpn2', 'tunnel', { direction: 'bidirectional' }), sourceHandle: 'right', targetHandle: 'left' },
      { ...edge('vpn2', 'vpn3', 'tunnel', { direction: 'bidirectional' }), sourceHandle: 'right', targetHandle: 'left' },
    ],
  },
})

// PUT /api/settings restarts the scheduler; its uptime checks against documentation IPs would flip
// every monitored VPS to "down", so the demo runs without it.
stopScheduler()
console.log('demo seeded:', Object.keys(vps).length, 'VPS')
if (process.argv.includes('--serve')) {
  const port = Number(process.env.PORT ?? 3101)
  await app.listen({ port, host: '127.0.0.1' })
  console.log(`demo UI: http://127.0.0.1:${port}/dashboard`)
} else {
  await app.close()
  process.exit(0)
}
