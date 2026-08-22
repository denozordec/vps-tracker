import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

const TTL_SEC = 20 * 60

export function ingestSecret(env: NodeJS.ProcessEnv = process.env): string {
  return (
    env.CENSORCHECK_INGEST_SECRET ||
    env.AUTH_JWT_SECRET ||
    env.JWT_SECRET ||
    (env.NODE_ENV === 'production' ? '' : 'dev-secret-change-me')
  )
}

export function mintIngestToken(
  secret: string,
  ttlSec = TTL_SEC,
  nowMs = Date.now(),
): string {
  const payload = Buffer.from(
    JSON.stringify({
      jti: randomBytes(16).toString('hex'),
      exp: Math.floor(nowMs / 1000) + ttlSec,
    }),
    'utf8',
  ).toString('base64url')
  const sig = createHmac('sha256', secret).update(payload).digest('base64url')
  return `${payload}.${sig}`
}

export function verifyIngestToken(
  token: string,
  secret: string,
  nowMs = Date.now(),
): boolean {
  if (!secret || !token) return false
  const [payload, sig] = token.split('.')
  if (!payload || !sig) return false
  const expected = createHmac('sha256', secret).update(payload).digest()
  let given: Buffer
  try {
    given = Buffer.from(sig, 'base64url')
  } catch {
    return false
  }
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return false
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      exp?: unknown
    }
    if (typeof data.exp !== 'number') return false
    return data.exp * 1000 > nowMs
  } catch {
    return false
  }
}

export function bearerToken(header: string | string[] | undefined): string | null {
  const raw = Array.isArray(header) ? header[0] : header
  if (!raw) return null
  const match = /^Bearer\s+(.+)$/i.exec(raw.trim())
  return match?.[1]?.trim() || null
}
