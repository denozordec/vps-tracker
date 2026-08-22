import { describe, expect, it } from 'vitest'

import { kitDataGridTableLayout } from './frame-data-grid'
import { BLOCKING_MATRIX_GRID } from '../censorcheck/blocking-grid'

describe('kitDataGridTableLayout', () => {
  it('CRUD defaults: без bg-muted header и width fixed', () => {
    const layout = kitDataGridTableLayout()
    expect(layout.headerBackground).toBe(false)
    expect(layout.width).toBe('fixed')
    expect(layout.headerSticky).toBe(true)
    expect(layout.columnsPinnable).toBe(false)
  })

  it('матрица: auto + pin', () => {
    const layout = kitDataGridTableLayout({
      width: 'auto',
      columnsPinnable: true,
    })
    expect(layout.width).toBe('auto')
    expect(layout.columnsPinnable).toBe(true)
    expect(layout.headerBackground).toBe(false)
  })
})

describe('BLOCKING_MATRIX_GRID', () => {
  it('data-grid-base-4: auto + horizontal scroll', () => {
    expect(BLOCKING_MATRIX_GRID.tableWidth).toBe('auto')
    expect(BLOCKING_MATRIX_GRID.horizontalScroll).toBe(true)
  })
})
