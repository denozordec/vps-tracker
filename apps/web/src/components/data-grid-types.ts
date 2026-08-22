import type { ReactNode, ComponentType } from 'react'
import type { LucideIcon } from 'lucide-react'

export interface DataGridColumn<T> {
  key: string
  header: ReactNode
  cell: (row: T, index: number) => ReactNode
  icon?: LucideIcon | ComponentType<{ className?: string }>
  sortable?: boolean
  sortValue?: (row: T) => string | number
  /** TanStack v9 `sortFn`; для числовых sortValue — `'basic'`. */
  sortingFn?: 'auto' | 'alphanumeric' | 'basic' | 'text' | 'datetime'
  headerTitle?: string
  className?: string
  headerClassName?: string
  enableHiding?: boolean
  size?: number
  minSize?: number
  maxSize?: number
  enablePinning?: boolean
}

/** @deprecated Используйте DataGridColumn */
export type DataTableColumn<T> = DataGridColumn<T>

/** Унифицированные классы колонок для FrameDataGrid. */
export const COL = {
  num: 'w-28 text-right tabular-nums',
  date: 'w-32 text-right tabular-nums text-muted-foreground',
  actions: 'w-24 text-right',
} as const
