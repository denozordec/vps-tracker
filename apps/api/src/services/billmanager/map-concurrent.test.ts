import { describe, expect, it } from 'vitest'
import { mapConcurrent } from './sync.js'

describe('mapConcurrent', () => {
  it('keeps order and caps parallelism', async () => {
    let active = 0
    let peak = 0
    const out = await mapConcurrent([5, 1, 4, 2, 3, 0], 2, async (n) => {
      active++
      peak = Math.max(peak, active)
      await new Promise((r) => setTimeout(r, n))
      active--
      return n * 10
    })
    expect(out).toEqual([50, 10, 40, 20, 30, 0])
    expect(peak).toBe(2)
  })
})
