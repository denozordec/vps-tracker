import { describe, expect, it } from 'vitest'
import { GlobeIcon } from 'lucide-react'
import {
  IPREGION_CDN_SERVICES,
  IPREGION_CUSTOM_SERVICES,
  IPREGION_PRIMARY_SERVICES,
} from '@cfdm/shared/contracts/ipregion'

import { resolveServiceIcon } from './service-icons'

describe('resolveServiceIcon', () => {
  it('резолвит все GeoIP-сервисы без fallback Globe', () => {
    const keys = [
      ...IPREGION_PRIMARY_SERVICES,
      ...IPREGION_CUSTOM_SERVICES,
      ...IPREGION_CDN_SERVICES,
    ]
    for (const key of keys) {
      expect(resolveServiceIcon(key), key).not.toBe(GlobeIcon)
    }
  })

  it('unknown / custom → Globe', () => {
    expect(resolveServiceIcon('unknown.example')).toBe(GlobeIcon)
  })
})
