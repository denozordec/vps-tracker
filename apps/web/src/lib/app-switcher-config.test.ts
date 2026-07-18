import { describe, expect, it } from 'vitest'

import {
  CURRENT_APP_ID,
  DEFAULT_APP_SWITCHER_CONFIG,
  getCurrentApp,
} from '@/lib/app-switcher-config'

describe('DEFAULT_APP_SWITCHER_CONFIG', () => {
  it('использует portal app ids', () => {
    const ids = DEFAULT_APP_SWITCHER_CONFIG.apps.map((app) => app.id)
    expect(ids).toEqual(['vps', 'cfdm', 'bgp'])
  })
})

describe('getCurrentApp', () => {
  it('находит текущее приложение по CURRENT_APP_ID', () => {
    const current = getCurrentApp(DEFAULT_APP_SWITCHER_CONFIG)
    expect(current.id).toBe(CURRENT_APP_ID)
    expect(CURRENT_APP_ID).toBe('vps')
    expect(current.name).toBe('VPS Tracker')
  })
})
