import { describe, expect, it } from 'vitest'
import type { Filter } from '@/components/reui/filters'
import { filterCensorcheckRuns, groupRunsByService, collectServiceColumns, collectProbeColumns, shortHostLabel } from './blocking-filters'
import type { CensorcheckRunDto } from './types'

const run = (overrides: Partial<CensorcheckRunDto> = {}): CensorcheckRunDto => ({
  id: 'ccrun-1',
  spaceId: 'space-main',
  runId: '11111111-1111-4111-8111-111111111111',
  probePublicIp: '203.0.113.10',
  claimedPublicIp: null,
  matchedVpsId: 'vps-1',
  status: 'complete',
  schemaVersion: 1,
  launcherVersion: '1',
  censorcheckVersion: '1',
  summary: {
    total: 2,
    available: 1,
    redirected: 0,
    denied: 0,
    blocked: 1,
    timeout: 0,
    error: 0,
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
      runId: 'ccrun-1',
      serviceKey: 'youtube.com',
      serviceLabel: 'youtube.com',
      category: 'dpi',
      status: 'blocked',
      httpStatus: -1,
      detail: null,
    },
    {
      id: 'r2',
      runId: 'ccrun-1',
      serviceKey: 'netflix.com',
      serviceLabel: 'netflix.com',
      category: 'geoblock',
      status: 'available',
      httpStatus: 200,
      detail: null,
    },
  ],
  ...overrides,
})

describe('filterCensorcheckRuns', () => {
  it('фильтрует по статусу сервиса', () => {
    const filters: Filter[] = [
      { id: '1', field: 'status', operator: 'is_any_of', values: ['blocked'] },
    ]
    expect(filterCensorcheckRuns([run()], filters)).toHaveLength(1)
    expect(
      filterCensorcheckRuns([run()], [
        { id: '1', field: 'status', operator: 'is_any_of', values: ['timeout'] },
      ]),
    ).toHaveLength(0)
  })

  it('ищет по IP и DNS', () => {
    const filters: Filter[] = [
      { id: '1', field: 'q', operator: 'contains', values: ['edge.example'] },
    ]
    expect(filterCensorcheckRuns([run()], filters)).toHaveLength(1)
    expect(
      filterCensorcheckRuns([run()], [
        { id: '1', field: 'q', operator: 'contains', values: ['missing'] },
      ]),
    ).toHaveLength(0)
  })
})

describe('groupRunsByService', () => {
  it('собирает пробы по сервису', () => {
    const groups = groupRunsByService([run()])
    expect(groups.map((g) => g.serviceKey)).toEqual(['netflix.com', 'youtube.com'])
    expect(groups[1]?.probes[0]?.status).toBe('blocked')
    expect(groups[1]?.probes[0]?.httpStatus).toBe(-1)
  })
})

describe('collectServiceColumns', () => {
  it('ставит канонические сервисы первыми и custom в конец', () => {
    const cols = collectServiceColumns([
      run({
        results: [
          ...(run().results ?? []),
          {
            id: 'r3',
            runId: 'ccrun-1',
            serviceKey: 'custom.example',
            serviceLabel: 'custom.example',
            category: 'custom',
            status: 'available',
            httpStatus: 200,
            detail: null,
          },
        ],
      }),
    ])
    expect(cols[0]?.key).toBe('youtube.com')
    expect(cols.map((c) => c.key)).toContain('netflix.com')
    expect(cols.at(-1)?.key).toBe('custom.example')
  })
})

describe('collectProbeColumns', () => {
  it('берёт dns как короткий header', () => {
    expect(collectProbeColumns([run()])[0]).toMatchObject({
      key: 'ccrun-1',
      label: 'edge.example',
      title: 'edge.example.com',
    })
  })
})

describe('shortHostLabel', () => {
  it('отрезает типичный TLD', () => {
    expect(shortHostLabel('youtube.com')).toBe('youtube')
    expect(shortHostLabel('api.telegram.org')).toBe('api.telegram')
  })
})

