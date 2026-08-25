import { describe, expect, it } from 'vitest'
import { canonicalizeHoster } from '@cfdm/shared/contracts/censorcheck'

describe('canonicalizeHoster', () => {
  it('мапит ASN/org на короткое имя', () => {
    expect(canonicalizeHoster('AS14061 DigitalOcean, LLC')).toBe('DigitalOcean')
    expect(canonicalizeHoster('Hetzner Online GmbH')).toBe('Hetzner')
    expect(canonicalizeHoster('hosted-by.vdsina.ru')).toBe('VDSina')
    expect(canonicalizeHoster('  aeza.net.  ')).toBe('Aeza')
  })

  it('пустую строку отбрасывает', () => {
    expect(canonicalizeHoster('')).toBeNull()
    expect(canonicalizeHoster('   ')).toBeNull()
    expect(canonicalizeHoster(undefined)).toBeNull()
  })

  it('неизвестную org чистит без alias', () => {
    expect(canonicalizeHoster('AS12345 Example Hosting LLC')).toBe('Example Hosting')
  })
})
