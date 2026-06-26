import type { ReactNode } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@cfdm/ui/components/table'
import { TableCard } from './table-card'
import { EmptyState } from './empty-state'

export interface DataTableColumn<T> {
  key: string
  header: ReactNode
  cell: (row: T, index: number) => ReactNode
  className?: string
  headerClassName?: string
}

interface DataTableCardProps<T> {
  title?: ReactNode
  description?: ReactNode
  actions?: ReactNode
  columns: DataTableColumn<T>[]
  data: T[]
  rowKey: (row: T, index: number) => string
  emptyTitle?: string
  emptyDescription?: string
  emptyAction?: ReactNode
  onRowClick?: (row: T) => void
}

export function DataTableCard<T>({
  title,
  description,
  actions,
  columns,
  data,
  rowKey,
  emptyTitle = 'Нет записей',
  emptyDescription,
  emptyAction,
  onRowClick,
}: DataTableCardProps<T>) {
  return (
    <TableCard title={title} description={description} actions={actions}>
      {data.length === 0 ? (
        <div className="p-4">
          <EmptyState title={emptyTitle} description={emptyDescription} action={emptyAction} />
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((col) => (
                <TableHead key={col.key} className={col.headerClassName}>
                  {col.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row, index) => (
              <TableRow
                key={rowKey(row, index)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={onRowClick ? 'cursor-pointer' : undefined}
              >
                {columns.map((col) => (
                  <TableCell key={col.key} className={col.className}>
                    {col.cell(row, index)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </TableCard>
  )
}
