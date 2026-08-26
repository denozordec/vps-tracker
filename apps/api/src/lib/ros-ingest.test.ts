import { describe, expect, it } from 'vitest'
import { coerceRouterosIngestBody } from './ros-ingest.js'

describe('coerceRouterosIngestBody', () => {
  it('превращает results с числовыми ключами в массив', () => {
    const out = coerceRouterosIngestBody({
      schemaVersion: '1',
      runId: 'mt-abcdefghijklmnop',
      probe: { publicIp: '185.246.117.91' },
      results: {
        '0': { service: 'maxmind.com', ipv4: 'N/A' },
        '1': { service: 'ipinfo.io', ipv4: 'RU' },
      },
    }) as { schemaVersion: number; results: Array<{ service: string }> }

    expect(out.schemaVersion).toBe(1)
    expect(out.results).toEqual([
      { service: 'maxmind.com', ipv4: 'N/A' },
      { service: 'ipinfo.io', ipv4: 'RU' },
    ])
  })

  it('оставляет обычный массив без изменений', () => {
    const results = [{ service: 'ipinfo.io', ipv4: 'RU' }]
    const out = coerceRouterosIngestBody({
      schemaVersion: 1,
      results,
    }) as { results: unknown }
    expect(out.results).toBe(results)
  })

  it('парсит JSON-строку', () => {
    const out = coerceRouterosIngestBody(
      '{"schemaVersion":1,"results":{"0":{"service":"a"}}}',
    ) as { results: Array<{ service: string }> }
    expect(out.results).toEqual([{ service: 'a' }])
  })
})
