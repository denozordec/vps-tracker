import { describe, expect, it } from 'vitest'
import {
  normalizeIngestResult,
  statusFromErrorCode,
  statusFromHttpCode,
  summarizeResults,
} from './normalize.js'

describe('censorcheck normalize', () => {
  it('мапит HTTP-коды HTTPS IPv4', () => {
    expect(statusFromHttpCode(200)).toBe('available')
    expect(statusFromHttpCode(403)).toBe('denied')
    expect(statusFromHttpCode(301)).toBe('redirected')
    expect(statusFromHttpCode(0)).toBe('timeout')
    expect(statusFromHttpCode(-1)).toBe('blocked')
  })

  it('мапит error_code', () => {
    expect(statusFromErrorCode('blocked_by_ip')).toBe('blocked')
    expect(statusFromErrorCode('nxdomain')).toBe('error')
    expect(statusFromErrorCode('no_dns_record')).toBe('error')
  })

  it('берёт HTTPS IPv4 как primary', () => {
    const row = normalizeIngestResult({
      service: 'YouTube.com',
      raw: {
        http: { ipv4: { status: 403 } },
        https: { ipv4: { status: 200 } },
      },
    })
    expect(row.serviceKey).toBe('youtube.com')
    expect(row.category).toBe('dpi')
    expect(row.status).toBe('available')
    expect(row.httpStatus).toBe(200)
  })

  it('нормализует geoblock и timeout 000', () => {
    const row = normalizeIngestResult({
      service: 'netflix.com',
      raw: { https: { ipv4: { status: '000' } } },
    })
    expect(row.category).toBe('geoblock')
    expect(row.status).toBe('timeout')
    expect(row.httpStatus).toBe(0)
  })

  it('считает summary и partial при timeout', () => {
    const { summary, runStatus } = summarizeResults([
      { status: 'available' },
      { status: 'timeout' },
      { status: 'blocked' },
    ])
    expect(summary.total).toBe(3)
    expect(summary.available).toBe(1)
    expect(summary.timeout).toBe(1)
    expect(summary.blocked).toBe(1)
    expect(runStatus).toBe('partial')
  })
})
