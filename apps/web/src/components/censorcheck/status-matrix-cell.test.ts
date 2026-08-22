import { describe, expect, it } from 'vitest'
import {
  BanIcon,
  CheckIcon,
  CircleAlertIcon,
  ClockIcon,
  CornerUpRightIcon,
  XIcon,
} from 'lucide-react'

import { MATRIX_STATUS } from './status-matrix-cell'

describe('MATRIX_STATUS', () => {
  it('статусы — lucide-иконки, не текст ОК/Блок', () => {
    expect(MATRIX_STATUS.available.icon).toBe(CheckIcon)
    expect(MATRIX_STATUS.available.variant).toBe('success-light')
    expect(MATRIX_STATUS.blocked.icon).toBe(XIcon)
    expect(MATRIX_STATUS.blocked.variant).toBe('destructive-light')
    expect(MATRIX_STATUS.denied.icon).toBe(BanIcon)
    expect(MATRIX_STATUS.timeout.icon).toBe(ClockIcon)
    expect(MATRIX_STATUS.redirected.icon).toBe(CornerUpRightIcon)
    expect(MATRIX_STATUS.error.icon).toBe(CircleAlertIcon)
  })
})
