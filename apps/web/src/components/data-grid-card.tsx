import { useMemo, useState, type ReactNode } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table'

import { Card, CardContent, CardHeader, CardTitle } from '@cfdm/ui/components/card'
import {
  DataGrid,
  DataGridContainer,
} from '@/components/reui/data-grid/data-grid'
import { DataGridTable } from '@/components/reui/data-grid/data-grid-table'
import { DataGridTableVirtual } from '@/components/reui/data-grid/data-grid-table-virtual'
import { DataGridScrollArea } from '@/components/reui/data-grid/data-grid-scroll-area'
import { DataGridPagination } from '@/components/reui/data-grid/data-grid-pagination'
import { EmptyState } from './empty-state'

export interface DataGridCardProps<TData extends object> {
  title?: ReactNode
  description?: ReactNode
  actions?: ReactNode
  columns: ColumnDef<TData, unknown>[]
  data: TData[]
  /** Ключ строки — функция, возвращающая уникальный id. */
  rowId?: (row: TData, index: number) => string
  emptyTitle?: string
  emptyDescription?: string
  emptyAction?: ReactNode
  onRowClick?: (row: TData) => void
  /** Включить пагинацию. По умолчанию true для >25 строк. */
  pagination?: boolean
  /** Размер страницы. По умолчанию 25. */
  pageSize?: number
  /** Footer-контент (итоги). */
  footerContent?: ReactNode
  /** Плотный layout. */
  dense?: boolean
  /** Колонка действий закреплена справа. */
  pinLastColumn?: boolean
  /** Сортировка по умолчанию. */
  initialSorting?: SortingState
  /** Включить виртуализацию строк (для тяжёлых таблиц). Требует height. */
  virtualization?: boolean
  /** Высота viewport для виртуализации (px). По умолчанию 480. */
  height?: number
  className?: string
}

export function DataGridCard<TData extends object>({
  title,
  description,
  actions,
  columns,
  data,
  rowId,
  emptyTitle = 'Нет записей',
  emptyDescription,
  emptyAction,
  onRowClick,
  pagination,
  pageSize = 25,
  footerContent,
  dense = false,
  pinLastColumn = false,
  initialSorting,
  virtualization = false,
  height = 480,
  className,
}: DataGridCardProps<TData>) {
  const [sorting, setSorting] = useState<SortingState>(initialSorting ?? [])

  const lastColId = pinLastColumn ? columns[columns.length - 1]?.id ?? '' : ''

  const columnsWithIds = useMemo(() => {
    if (rowId) return columns
    return columns
  }, [columns, rowId])

  const showPagination = pagination ?? data.length > pageSize

  const table = useReactTable<TData>({
    data,
    columns: columnsWithIds,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: showPagination ? getPaginationRowModel() : undefined,
    initialState: {
      ...(showPagination ? { pagination: { pageIndex: 0, pageSize } } : {}),
      ...(pinLastColumn && lastColId ? { columnPinning: { right: [lastColId] } } : {}),
    },
    getRowId: rowId
      ? (row, index) => rowId(row, index)
      : undefined,
    enableColumnPinning: pinLastColumn,
  })

  if (data.length === 0) {
    return (
      <Card className={className}>
        {(title || actions) && (
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <div className="space-y-1">
              {title ? <CardTitle>{title}</CardTitle> : null}
              {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
            </div>
            {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
          </CardHeader>
        )}
        <CardContent className="p-4">
          <EmptyState title={emptyTitle} description={emptyDescription} action={emptyAction} />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={className}>
      {(title || actions) && (
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <div className="space-y-1">
            {title ? <CardTitle>{title}</CardTitle> : null}
            {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
          </div>
          {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
        </CardHeader>
      )}
      <CardContent className="p-0">
        <DataGridContainer className="border-0 rounded-none">
          <DataGrid
            table={table}
            recordCount={data.length}
            onRowClick={onRowClick}
            emptyMessage={emptyTitle}
            tableLayout={{
              dense,
              rowBorder: true,
              headerSticky: true,
              headerBackground: true,
              headerBorder: true,
              width: 'auto',
              columnsVisibility: false,
              columnsResizable: false,
              columnsPinnable: false,
              columnsMovable: false,
              rowsDraggable: false,
              rowsPinnable: false,
            }}
          >
            {virtualization ? (
              <DataGridScrollArea orientation="vertical" style={{ height }}>
                <DataGridTableVirtual height={height} footerContent={footerContent} />
              </DataGridScrollArea>
            ) : (
              <>
                <DataGridTable footerContent={footerContent} />
                {showPagination ? <DataGridPagination /> : null}
              </>
            )}
          </DataGrid>
        </DataGridContainer>
      </CardContent>
    </Card>
  )
}

/** Хелпер для конвертации старых DataTableColumn<T> → ColumnDef<T>. */
export function columnDefFromDataTable<T>(
  cols: {
    key: string
    header: ReactNode
    cell: (row: T, index: number) => ReactNode
    className?: string
    headerClassName?: string
  }[],
): ColumnDef<T, unknown>[] {
  return cols.map((c) => ({
    id: c.key,
    header: () => c.header,
    cell: ({ row }) => c.cell(row.original, row.index),
    meta: { className: c.className, headerClassName: c.headerClassName },
  }))
}

/** re-export flexRender для удобства использования в колонках. */
export { flexRender }
