import { DEFAULT_PROFILE } from './default.js'
import { firstbyteOverrides } from './firstbyte.js'
import { mergeProfile } from './merge.js'
import type { BillmanagerProfile, BillmanagerProfileOverrides } from './types.js'
import { waicoreOverrides } from './waicore.js'

/**
 * Hoster override list — first match wins.
 * Add new hosters here after creating profiles/<id>.ts.
 */
export const PROFILE_OVERRIDES: BillmanagerProfileOverrides[] = [
  waicoreOverrides,
  firstbyteOverrides,
]

function matchesUrl(url: string, override: BillmanagerProfileOverrides): boolean {
  const match = override.match
  if (!match) return false

  let hostname = ''
  try {
    hostname = new URL(url).hostname.toLowerCase()
  } catch {
    hostname = ''
  }
  const haystack = url.toLowerCase()

  if (match.hostnames?.some((h) => hostname.includes(h.toLowerCase()))) {
    return true
  }
  if (match.keywords?.some((k) => haystack.includes(k.toLowerCase()))) {
    return true
  }
  return false
}

/** Resolve profile for apiBaseUrl: first matching override merged onto DEFAULT, else DEFAULT. */
export function resolveBillmanagerProfile(apiBaseUrl: string): BillmanagerProfile {
  const url = String(apiBaseUrl || '').trim()
  if (!url) return DEFAULT_PROFILE

  for (const override of PROFILE_OVERRIDES) {
    if (matchesUrl(url, override)) {
      return mergeProfile(DEFAULT_PROFILE, override)
    }
  }
  return DEFAULT_PROFILE
}
