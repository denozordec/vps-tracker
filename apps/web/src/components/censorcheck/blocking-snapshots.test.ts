import { describe, expect, it } from 'vitest'

import {
  collectSnapshotTicks,
  latestRunsAsOf,
  mergeCensorcheckRuns,
  resolveSnapshotIndex,
  snapshotDayKey,
} from './blocking-snapshots'
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
    total: 1,
    available: 1,
    redirected: 0,
    denied: 0,
    blocked: 0,
    timeout: 0,
    error: 0,
  },
  createdAt: '2026-08-22T10:00:00.000Z',
  completedAt: '2026-08-22T10:00:00.000Z',
  observedSourceIp: '203.0.113.10',
  vps: null,
  results: [],
  ...overrides,
})

describe('mergeCensorcheckRuns', () => {
  it('дедуплицирует по id, current побеждает', () => {
    const older = run({ id: 'a', summary: { ...run().summary, blocked: 0 } })
    const newer = run({ id: 'a', summary: { ...run().summary, blocked: 3 } })
    const merged = mergeCensorcheckRuns([newer], [older, run({ id: 'b' })])
    expect(merged).toHaveLength(2)
    expect(merged.find((item) => item.id === 'a')?.summary.blocked).toBe(3)
  })
})

describe('collectSnapshotTicks', () => {
  it('группирует по дню и берёт max createdAt', () => {
    const ticks = collectSnapshotTicks([
      run({ id: '1', createdAt: '2026-08-20T08:00:00.000Z' }),
      run({ id: '2', createdAt: '2026-08-20T18:00:00.000Z' }),
      run({ id: '3', createdAt: '2026-08-21T12:00:00.000Z' }),
    ])
    expect(ticks.map((tick) => tick.key)).toEqual([
      snapshotDayKey('2026-08-20T08:00:00.000Z'),
      snapshotDayKey('2026-08-21T12:00:00.000Z'),
    ])
    expect(ticks[0]?.count).toBe(2)
    expect(ticks[0]?.asOf).toBe('2026-08-20T18:00:00.000Z')
  })
})

describe('latestRunsAsOf', () => {
  it('берёт последний прогон каждого IP на момент T', () => {
    const rows = [
      run({
        id: 'old',
        probePublicIp: '1.1.1.1',
        createdAt: '2026-08-20T10:00:00.000Z',
        summary: { ...run().summary, blocked: 1 },
      }),
      run({
        id: 'mid',
        probePublicIp: '1.1.1.1',
        createdAt: '2026-08-21T10:00:00.000Z',
        summary: { ...run().summary, blocked: 2 },
      }),
      run({
        id: 'new',
        probePublicIp: '1.1.1.1',
        createdAt: '2026-08-22T10:00:00.000Z',
        summary: { ...run().summary, blocked: 3 },
      }),
      run({
        id: 'other',
        probePublicIp: '2.2.2.2',
        createdAt: '2026-08-20T12:00:00.000Z',
      }),
    ]
    const asOf = latestRunsAsOf(rows, '2026-08-21T10:00:00.000Z')
    expect(asOf.map((item) => item.id).sort()).toEqual(['mid', 'other'])
    expect(asOf.find((item) => item.id === 'mid')?.summary.blocked).toBe(2)
  })
})

describe('resolveSnapshotIndex', () => {
  it('без выбора — последний тик', () => {
    expect(resolveSnapshotIndex(5, null)).toBe(4)
    expect(resolveSnapshotIndex(0, null)).toBe(0)
    expect(resolveSnapshotIndex(3, 9)).toBe(2)
  })
})
