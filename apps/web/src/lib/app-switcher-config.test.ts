import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  CURRENT_APP_ID,
  DEFAULT_APP_SWITCHER_CONFIG,
  getCurrentApp,
  parseAppSwitcherConfig,
} from '@/lib/app-switcher-config'

describe('parseAppSwitcherConfig', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('возвращает дефолты при пустом значении', () => {
    expect(parseAppSwitcherConfig()).toEqual(DEFAULT_APP_SWITCHER_CONFIG)
    expect(parseAppSwitcherConfig('')).toEqual(DEFAULT_APP_SWITCHER_CONFIG)
  })

  it('дефолты содержат оба приложения', () => {
    const ids = DEFAULT_APP_SWITCHER_CONFIG.apps.map((app) => app.id)
    expect(ids).toContain('vps-tracker')
    expect(ids).toContain('cfdm')
  })

  it('парсит override из JSON', () => {
    const raw = JSON.stringify({
      menuLabel: 'Сервисы',
      apps: [
        {
          id: 'vps-tracker',
          name: 'VPS',
          url: 'http://localhost:5173',
          icon: 'server',
        },
        {
          id: 'cfdm',
          name: 'CFDM',
          url: 'http://localhost:5174',
          icon: 'cloud',
        },
        {
          id: 'grafana',
          name: 'Grafana',
          url: 'https://grafana.example.com',
          icon: 'chart',
        },
      ],
    })

    const config = parseAppSwitcherConfig(raw)
    expect(config.menuLabel).toBe('Сервисы')
    expect(config.apps).toHaveLength(3)
    expect(config.apps[2]?.name).toBe('Grafana')
  })

  it('при невалидном JSON возвращает дефолты и пишет предупреждение', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    expect(parseAppSwitcherConfig('{invalid')).toEqual(DEFAULT_APP_SWITCHER_CONFIG)
    expect(warnSpy).toHaveBeenCalled()
  })
})

describe('getCurrentApp', () => {
  it('находит текущее приложение по CURRENT_APP_ID', () => {
    const current = getCurrentApp(DEFAULT_APP_SWITCHER_CONFIG)
    expect(current.id).toBe(CURRENT_APP_ID)
    expect(current.name).toBe('VPS Tracker')
  })
})
