/**
 * Screenshots for README/docs via Chrome DevTools Protocol (no extra deps: Node ≥ 22 has WebSocket).
 * Start the demo first (see seed-demo.ts --serve), then:
 *
 *   node apps/api/scripts/docs-screenshots.mjs [outDir=docs/screenshots]
 *
 * Env: BASE (default http://127.0.0.1:3101), CHROME (path to chrome/msedge).
 * Waits for real time (not virtual time) so Recharts animations finish before the shot.
 */
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const outDir = process.argv[2] ?? 'docs/screenshots'
const BASE = process.env.BASE ?? 'http://127.0.0.1:3101'
const CHROME =
  process.env.CHROME ??
  [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ].find(existsSync)
const PORT = 9333
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const getJson = async (path) => (await fetch(BASE + path)).json()
const vps = await getJson('/api/vps')
const projects = await getJson('/api/projects')
const vpsId = (dns) => vps.find((v) => v.dns === dns)?.id
const mobile = { width: 390, height: 844, mobile: true }

const jobs = [
  { name: 'dashboard', path: '/dashboard' },
  { name: 'dashboard-charts', path: '/dashboard', scrollY: 700 },
  { name: 'vps', path: '/vps' },
  { name: 'vps-detail', path: `/vps/${vpsId('web-1.example.net')}` },
  { name: 'vps-detail-finance', path: `/vps/${vpsId('monitor.example.net')}`, clickText: 'Финансы' },
  { name: 'blocking', path: '/blocking' },
  { name: 'geo', path: '/geo' },
  { name: 'topology', path: '/topology', waitMs: 4500 },
  { name: 'tariffs', path: '/tariffs' },
  { name: 'providers', path: '/providers' },
  { name: 'accounts', path: '/accounts' },
  { name: 'projects', path: '/projects' },
  { name: 'project-detail', path: `/projects/${projects.find((p) => p.name === 'VPN')?.id}` },
  { name: 'payments', path: '/payments' },
  { name: 'balance', path: '/balance' },
  { name: 'reports', path: '/reports' },
  { name: 'resources', path: '/resources' },
  { name: 'renewals', path: '/renewals' },
  { name: 'settings', path: '/settings' },
  { name: 'settings-sync', path: '/settings/sync' },
  { name: 'settings-notifications', path: '/settings/notifications' },
  { name: 'settings-integrations', path: '/settings/integrations' },
  { name: 'sync-journal', path: '/sync-journal' },
  { name: 'audit', path: '/audit' },
  { name: 'mobile-dashboard', path: '/dashboard', ...mobile },
  { name: 'mobile-vps', path: '/vps', ...mobile },
]

mkdirSync(outDir, { recursive: true })
const chrome = spawn(
  CHROME,
  [
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${mkdtempSync(join(tmpdir(), 'vt-shots-'))}`,
    'about:blank',
  ],
  { stdio: 'ignore' },
)

let target
for (let i = 0; i < 50 && !target; i++) {
  await sleep(200)
  try {
    target = (await getJsonAbs(`http://127.0.0.1:${PORT}/json`)).find((t) => t.type === 'page')
  } catch {}
}
async function getJsonAbs(url) {
  return (await fetch(url)).json()
}

const ws = new WebSocket(target.webSocketDebuggerUrl)
await new Promise((r) => ws.addEventListener('open', r))
let seq = 0
const pending = new Map()
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data)
  if (m.id && pending.has(m.id)) {
    pending.get(m.id)(m)
    pending.delete(m.id)
  }
})
const send = (method, params = {}) =>
  new Promise((r) => {
    const id = ++seq
    pending.set(id, r)
    ws.send(JSON.stringify({ id, method, params }))
  })
const evaluate = async (expression) =>
  (await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })).result?.result
    ?.value

await send('Page.enable')
await send('Runtime.enable')
for (const job of jobs) {
  await send('Emulation.setDeviceMetricsOverride', {
    width: job.width ?? 1440,
    height: job.height ?? 900,
    deviceScaleFactor: job.mobile ? 2 : 1,
    mobile: Boolean(job.mobile),
  })
  await send('Page.navigate', { url: BASE + job.path })
  await sleep(job.waitMs ?? 3500)
  if (job.clickText) {
    // Base UI tabs react to real pointer input, so click via CDP at the element's centre.
    for (let i = 0; i < 20 && !(await evaluate(`document.querySelectorAll('[role=tab]').length`)); i++)
      await sleep(500)
    const pos = await evaluate(`(() => {
      const el = [...document.querySelectorAll('button,[role=tab],a')]
        .find((e) => (e.innerText || '').trim().startsWith(${JSON.stringify(job.clickText)}))
      if (!el) return null
      const r = el.getBoundingClientRect()
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 } })()`)
    if (!pos) console.warn(job.name, 'not found:', job.clickText)
    else
      for (const type of ['mousePressed', 'mouseReleased'])
        await send('Input.dispatchMouseEvent', { type, x: pos.x, y: pos.y, button: 'left', clickCount: 1 })
    await sleep(1800)
  }
  if (job.scrollY) {
    await evaluate(`window.scrollBy(0, ${job.scrollY})`)
    await sleep(1200)
  }
  const shot = await send('Page.captureScreenshot', { format: 'png' })
  writeFileSync(join(outDir, `${job.name}.png`), Buffer.from(shot.result.data, 'base64'))
  console.log('ok', job.name)
}
ws.close()
chrome.kill()
process.exit(0)
