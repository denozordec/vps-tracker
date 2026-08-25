import { describe, expect, it } from 'vitest'
import type { Filter } from '@/components/reui/filters'
import {
  collectServiceColumns,
  filterIpregionRuns,
  isGeoMismatch,
  uniqueCountries,
} from './geo-filters'
import { runHosterLabel, type IpregionRunDto } from './types'

const run = (overrides: Partial<IpregionRunDto> = {}): IpregionRunDto => ({
  id: 'iprun-1',
  spaceId: 'space-main',
  runId: '11111111-1111-4111-8111-111111111111',
  probePublicIp: '203.0.113.10',
  claimedPublicIp: null,
  matchedVpsId: 'vps-1',
  status: 'complete',
  schemaVersion: 1,
  launcherVersion: '1',
  ipregionVersion: '1',
  summary: {
    total: 2,
    ok: 2,
    na: 0,
    denied: 0,
    rate_limit: 0,
    server_error: 0,
  },
  createdAt: '2026-08-22T00:00:00.000Z',
  completedAt: '2026-08-22T00:00:00.000Z',
  observedSourceIp: '203.0.113.10',
  vps: {
    id: 'vps-1',
    ip: '203.0.113.10',
    dns: 'edge.example.com',
    providerId: 'p1',
    providerName: 'Hoster',
    country: 'Нидерланды',
    city: 'Amsterdam',
    datacenter: 'AMS',
    vcpu: 2,
    ramGb: 4,
    diskGb: 40,
  },
  results: [
    {
      id: 'r1',
      runId: 'iprun-1',
      serviceKey: 'maxmind.com',
      serviceLabel: 'maxmind.com',
      group: 'primary',
      countryIpv4: 'NL',
      countryIpv6: null,
      status: 'ok',
    },
    {
      id: 'r2',
      runId: 'iprun-1',
      serviceKey: 'google',
      serviceLabel: 'Google',
      group: 'custom',
      countryIpv4: 'US',
      countryIpv6: null,
      status: 'ok',
    },
  ],
  ...overrides,
})

describe('filterIpregionRuns', () => {
  it('фильтрует по ISO страны', () => {
    const filters: Filter[] = [
      { id: '1', field: 'country', operator: 'contains', values: ['NL'] },
    ]
    expect(filterIpregionRuns([run()], filters)).toHaveLength(1)
    expect(
      filterIpregionRuns([run()], [
        { id: '1', field: 'country', operator: 'contains', values: ['JP'] },
      ]),
    ).toHaveLength(0)
  })
})

describe('runHosterLabel', () => {
  it('предпочитает имя из инвентаря', () => {
    expect(runHosterLabel(run())).toBe('Hoster')
  })
})

describe('collectServiceColumns', () => {
  it('ставит primary, затем custom, затем cdn', () => {
    const cols = collectServiceColumns([run()])
    expect(cols[0]?.key).toBe('maxmind.com')
    expect(cols[0]?.group).toBe('primary')
    const google = cols.find((col) => col.key === 'google')
    const maxmind = cols.find((col) => col.key === 'maxmind.com')
    const cdn = cols.find((col) => col.key === 'cloudflare cdn')
    expect(google).toBeDefined()
    expect(cdn).toBeDefined()
    expect(cols.indexOf(maxmind!)).toBeLessThan(cols.indexOf(google!))
    expect(cols.indexOf(google!)).toBeLessThan(cols.indexOf(cdn!))
  })
})

describe('uniqueCountries / mismatch', () => {
  it('собирает уникальные ISO', () => {
    expect(uniqueCountries([run()]).sort()).toEqual(['NL', 'US'])
  })

  it('извлекает ISO из CDN SE (ARN)', () => {
    expect(
      uniqueCountries([
        run({
          results: [
            {
              id: 'r-cdn',
              runId: 'iprun-1',
              serviceKey: 'cloudflare cdn',
              serviceLabel: 'Cloudflare CDN',
              group: 'cdn',
              countryIpv4: 'SE (ARN)',
              countryIpv6: null,
              status: 'ok',
            },
          ],
        }),
      ]),
    ).toEqual(['SE'])
  })

  it('считает расхождение с инвентарём', () => {
    expect(
      isGeoMismatch(
        run({
          results: [
            {
              id: 'r1',
              runId: 'iprun-1',
              serviceKey: 'maxmind.com',
              serviceLabel: 'maxmind.com',
              group: 'primary',
              countryIpv4: 'US',
              countryIpv6: null,
              status: 'ok',
            },
            {
              id: 'r2',
              runId: 'iprun-1',
              serviceKey: 'google',
              serviceLabel: 'Google',
              group: 'custom',
              countryIpv4: 'US',
              countryIpv6: null,
              status: 'ok',
            },
          ],
        }),
      ),
    ).toBe(true)
    expect(
      isGeoMismatch(
        run({
          results: [
            {
              id: 'r1',
              runId: 'iprun-1',
              serviceKey: 'maxmind.com',
              serviceLabel: 'maxmind.com',
              group: 'primary',
              countryIpv4: 'NL',
              countryIpv6: null,
              status: 'ok',
            },
          ],
        }),
      ),
    ).toBe(false)
  })
})
