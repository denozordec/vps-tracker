import { beforeEach, describe, expect, it } from 'vitest'
import { settingsRepository } from './settings.js'
import { resetTestDb } from '../test-setup.js'

describe('settingsRepository', () => {
  beforeEach(() => {
    resetTestDb()
  })

  it('preserves telegram token on update when token empty', () => {
    settingsRepository.upsert('settings-main', {
      telegramBotToken: 'secret-token',
      telegramChatId: '-100123',
    })
    const updated = settingsRepository.upsert('settings-main', {
      telegramBotToken: '',
      syncIntervalMinutes: 30,
    })
    expect(updated.telegramBotTokenSet).toBe(true)
    expect(settingsRepository.getRow('settings-main')?.telegramBotToken).toBe('secret-token')
    expect(updated.syncIntervalMinutes).toBe(30)
  })

  it('replaces telegram token when new value provided', () => {
    settingsRepository.upsert('settings-main', {
      telegramBotToken: 'old-token',
    })
    settingsRepository.upsert('settings-main', {
      telegramBotToken: 'new-token',
    })
    expect(settingsRepository.getRow('settings-main')?.telegramBotToken).toBe('new-token')
  })

  it('defaults telegramApiUrl to cloud origin and persists a custom URL', () => {
    const created = settingsRepository.upsert('settings-main', {
      telegramChatId: '-100',
    })
    expect(created.telegramApiUrl).toBe('https://api.telegram.org')

    const updated = settingsRepository.upsert('settings-main', {
      telegramApiUrl: 'http://127.0.0.1:8081/',
    })
    expect(updated.telegramApiUrl).toBe('http://127.0.0.1:8081')
  })
})
