import { describe, expect, it } from 'vitest'
import {
  CENSORCHECK_DPI_HOSTS,
  CENSORCHECK_GEOBLOCK_HOSTS,
} from '@cfdm/shared/contracts/censorcheck'
import { GlobeIcon } from 'lucide-react'

import { resolveServiceIcon } from './service-icons'

describe('resolveServiceIcon', () => {
  it('резолвит все DPI и geo хосты без fallback Globe', () => {
    const hosts = [...CENSORCHECK_DPI_HOSTS, ...CENSORCHECK_GEOBLOCK_HOSTS]
    for (const host of hosts) {
      expect(resolveServiceIcon(host), host).not.toBe(GlobeIcon)
    }
  })

  it('unknown / custom → Globe', () => {
    expect(resolveServiceIcon('unknown.example')).toBe(GlobeIcon)
  })
})
