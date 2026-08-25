import { describe, expect, it } from 'vitest'
import {
  canonicalizeCountryValue,
  inferIpregionGroup,
} from '@cfdm/shared/contracts/ipregion'
import { normalizeIngestResult, summarizeResults } from './normalize.js'

describe('canonicalizeCountryValue', () => {
  it('мапит ISO в ok', () => {
    expect(canonicalizeCountryValue('RU')).toEqual({ status: 'ok', country: 'RU', iata: null })
    expect(canonicalizeCountryValue(' de ')).toEqual({ status: 'ok', country: 'DE', iata: null })
  })

  it('мапит CDN ISO + IATA', () => {
    expect(canonicalizeCountryValue('SE (ARN)')).toEqual({
      status: 'ok',
      country: 'SE',
      iata: 'ARN',
    })
    expect(canonicalizeCountryValue('RS (BEG)')).toEqual({
      status: 'ok',
      country: 'RS',
      iata: 'BEG',
    })
    expect(canonicalizeCountryValue('(ARN)')).toEqual({
      status: 'ok',
      country: null,
      iata: 'ARN',
    })
  })

  it('мапит статусы ipregion', () => {
    expect(canonicalizeCountryValue('N/A').status).toBe('na')
    expect(canonicalizeCountryValue('Denied').status).toBe('denied')
    expect(canonicalizeCountryValue('Rate-limit').status).toBe('rate_limit')
    expect(canonicalizeCountryValue('Rate limit').status).toBe('rate_limit')
    expect(canonicalizeCountryValue('Server error').status).toBe('server_error')
  })
})

describe('ipregion normalize', () => {
  it('нормализует сервис и группу', () => {
    const row = normalizeIngestResult({
      service: 'Maxmind.com',
      ipv4: 'NL',
      ipv6: 'N/A',
    })
    expect(row.serviceKey).toBe('maxmind.com')
    expect(row.group).toBe('primary')
    expect(row.status).toBe('ok')
    expect(row.countryIpv4).toBe('NL')
    expect(row.countryIpv6).toBeNull()
  })

  it('берёт IPv6 если IPv4 N/A', () => {
    const row = normalizeIngestResult({
      service: 'YouTube CDN',
      group: 'cdn',
      ipv4: 'N/A',
      ipv6: 'US',
    })
    expect(row.status).toBe('ok')
    expect(row.countryIpv6).toBe('US')
    expect(row.group).toBe('cdn')
  })

  it('сохраняет CDN ISO + IATA и N/A', () => {
    const cf = normalizeIngestResult({
      service: 'Cloudflare CDN',
      group: 'cdn',
      ipv4: 'SE (ARN)',
    })
    expect(cf.status).toBe('ok')
    expect(cf.countryIpv4).toBe('SE (ARN)')
    expect(cf.group).toBe('cdn')

    const yt = normalizeIngestResult({
      service: 'YouTube CDN',
      ipv4: 'RS (BEG)',
    })
    expect(yt.status).toBe('ok')
    expect(yt.countryIpv4).toBe('RS (BEG)')

    const nflx = normalizeIngestResult({
      service: 'Netflix CDN',
      ipv4: 'N/A',
    })
    expect(nflx.status).toBe('na')
    expect(nflx.countryIpv4).toBeNull()
  })

  it('считает summary и partial', () => {
    const { summary, runStatus } = summarizeResults([
      { status: 'ok' },
      { status: 'na' },
      { status: 'denied' },
    ])
    expect(summary.total).toBe(3)
    expect(summary.ok).toBe(1)
    expect(summary.denied).toBe(1)
    expect(runStatus).toBe('partial')
  })

  it('угадывает группу по имени', () => {
    expect(inferIpregionGroup('cloudflare.com')).toBe('primary')
    expect(inferIpregionGroup('Netflix')).toBe('custom')
    expect(inferIpregionGroup('YouTube CDN')).toBe('cdn')
  })
})
