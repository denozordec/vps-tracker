import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

export interface DataTableColumn<T> {
  key: string
  header: ReactNode
  cell: (row: T, index: number) => ReactNode
  icon?: LucideIcon
  sortable?: boolean
  sortValue?: (row: T) => string | number
  headerTitle?: string
  className?: string
  headerClassName?: string
}

/** Унифицированные классы колонок для DataGridCard. */
export const COL = {
  num: 'w-28 text-right tabular-nums',
  date: 'w-32 text-right tabular-nums text-muted-foreground',
  actions: 'w-24 text-right',
} as const
