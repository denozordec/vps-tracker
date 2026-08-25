import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify'
import { ingestSecret, mintIngestToken } from '../services/censorcheck/ingest-token.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SCRIPT_DIR = join(__dirname, '..', '..', 'scripts', 'censorcheck')

export function censorcheckPublicUrl(env: NodeJS.ProcessEnv = process.env): string {
  if (env.CENSORCHECK_PUBLIC_URL?.trim()) {
    return env.CENSORCHECK_PUBLIC_URL.replace(/\/$/, '')
  }
  const host = env.VPS_LAUNCHER_DOMAIN || env.VPS_DOMAIN || 'vt.shnt.top'
  return `https://${host}`
}

function unixText(body: string): string {
  return body.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
}

function sendPlain(reply: FastifyReply, body: string, cache: 'no-store' | 'public'): void {
  void reply
    .header('Content-Type', 'text/plain; charset=utf-8')
    .header(
      'Cache-Control',
      cache === 'no-store' ? 'no-store, no-cache, must-revalidate' : 'public, max-age=3600',
    )
    .send(unixText(body))
}

const IPREGION_SCRIPT_DIR = join(__dirname, '..', '..', 'scripts', 'ipregion')

function mintLauncherScript(
  reply: FastifyReply,
  secret: string | undefined,
  scriptDir: string,
  missingSecretMessage: string,
): void {
  if (!secret) {
    void reply.code(503).send(missingSecretMessage)
    return
  }
  const apiUrl = censorcheckPublicUrl()
  const token = mintIngestToken(secret)
  let template: string
  try {
    template = readFileSync(join(scriptDir, 'launcher.sh'), 'utf8')
  } catch {
    void reply.code(500).send('launcher template missing\n')
    return
  }
  const script = template
    .replaceAll('__VT_API_URL__', apiUrl)
    .replaceAll('__VT_INGEST_TOKEN__', token)
  sendPlain(reply, script, 'no-store')
}

function sendVendor(reply: FastifyReply, filePath: string): void {
  try {
    const body = readFileSync(filePath, 'utf8')
    sendPlain(reply, body, 'public')
  } catch {
    void reply.code(500).send('vendor script missing\n')
  }
}

export const launcherRoutes: FastifyPluginAsync = async (app) => {
  const secret = ingestSecret()

  const ccOpts =
    process.env.VITEST || process.env.CENSORCHECK_RATE_LIMIT === '0'
      ? {}
      : { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }

  app.get('/cc', ccOpts, async (_request: FastifyRequest, reply: FastifyReply) => {
    mintLauncherScript(reply, secret, SCRIPT_DIR, 'censorcheck ingest is not configured\n')
  })

  app.get('/cc/vendor', async (_request, reply) => {
    sendVendor(reply, join(SCRIPT_DIR, 'censorcheck.sh'))
  })

  app.get('/ic', ccOpts, async (_request: FastifyRequest, reply: FastifyReply) => {
    mintLauncherScript(reply, secret, IPREGION_SCRIPT_DIR, 'ipregion ingest is not configured\n')
  })

  app.get('/ic/vendor', async (_request, reply) => {
    sendVendor(reply, join(IPREGION_SCRIPT_DIR, 'ipregion.sh'))
  })
}
