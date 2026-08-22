import { describe, expect, it } from 'vitest'
import { mintIngestToken, verifyIngestToken } from './ingest-token.js'

describe('censorcheck ingest token', () => {
  const secret = 'test-ingest-secret-key'

  it('принимает свежий токен', () => {
    const token = mintIngestToken(secret)
    expect(verifyIngestToken(token, secret)).toBe(true)
  })

  it('отклоняет просроченный токен', () => {
    const token = mintIngestToken(secret, 20 * 60, Date.now() - 21 * 60 * 1000)
    expect(verifyIngestToken(token, secret)).toBe(false)
  })

  it('отклоняет подпись с другим секретом', () => {
    const token = mintIngestToken(secret)
    expect(verifyIngestToken(token, 'other-secret-key')).toBe(false)
  })

  it('отклоняет мусор', () => {
    expect(verifyIngestToken('not-a-token', secret)).toBe(false)
    expect(verifyIngestToken('', secret)).toBe(false)
  })
})
