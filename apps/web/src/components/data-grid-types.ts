import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

export interface DataGridColumn<T> {
  key: string
  header: ReactNode
  cell: (row: T, index: number) => ReactNode
  icon?: LucideIcon
  sortable?: boolean
  sortValue?: (row: T) => string | number
  headerTitle?: string
  className?: string
  headerClassName?: string
  enableHiding?: boolean
}

/** @deprecated Используйте DataGridColumn */
export type DataTableColumn<T> = DataGridColumn<T>

/** Унифицированные классы колонок для FrameDataGrid. */
export const COL = {
  num: 'w-28 text-right tabular-nums',
  date: 'w-32 text-right tabular-nums text-muted-foreground',
  actions: 'w-24 text-right',
} as const
