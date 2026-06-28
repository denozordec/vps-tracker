import { describe, expect, it } from 'vitest'
import {
  buildFourVpsCredentials,
  parseFourVpsCredentials,
} from '@cfdm/shared/utils/api-credentials'

describe('parseFourVpsCredentials', () => {
  it('parses panelId:apiKey', () => {
    expect(parseFourVpsCredentials('1:secret-key')).toEqual({
      panelId: 1,
      apiKey: 'secret-key',
    })
  })

  it('returns apiKey only when no colon', () => {
    expect(parseFourVpsCredentials('secret-only')).toEqual({
      panelId: null,
      apiKey: 'secret-only',
    })
  })

  it('handles empty', () => {
    expect(parseFourVpsCredentials('')).toEqual({ panelId: null, apiKey: '' })
  })
})

describe('buildFourVpsCredentials', () => {
  it('builds panelId:apiKey', () => {
    expect(buildFourVpsCredentials('1', 'key')).toBe('1:key')
  })

  it('returns key only without panel', () => {
    expect(buildFourVpsCredentials('', 'key')).toBe('key')
  })
})
