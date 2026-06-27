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
