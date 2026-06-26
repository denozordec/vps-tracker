import { useState, type ReactNode } from 'react'
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
import { DataGridColumnHeader } from '@/components/reui/data-grid/data-grid-column-header'
import { EmptyState } from './empty-state'
import type { DataTableColumn } from './data-table-card'

const PAGINATION_LABELS = {
  rowsPerPageLabel: 'Строк на странице',
  info: '{from}–{to} из {count}',
  previousPageLabel: 'Предыдущая страница',
  nextPageLabel: 'Следующая страница',
} as const

function resolveHeaderTitle(header: ReactNode, headerTitle?: string): string {
  if (headerTitle) return headerTitle
  if (typeof header === 'string') return header
  return ''
}

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
  /** Включить пагинацию. По умолчанию true. */
  pagination?: boolean
  /** Размер страницы. По умолчанию 10. */
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

function DataGridPaginationBar() {
  return (
    <div className="border-t px-4 py-2.5">
      <DataGridPagination {...PAGINATION_LABELS} />
    </div>
  )
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
  pageSize = 10,
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

  const showPagination = pagination ?? true

  const table = useReactTable<TData>({
    data,
    columns,
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
      <CardContent className={dense ? 'p-3' : 'p-4'}>
        <DataGridContainer>
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
              <>
                <DataGridScrollArea orientation="vertical" style={{ height }}>
                  <DataGridTableVirtual height={height} footerContent={footerContent} />
                </DataGridScrollArea>
                {showPagination ? <DataGridPaginationBar /> : null}
              </>
            ) : (
              <>
                <DataGridTable footerContent={footerContent} />
                {showPagination ? <DataGridPaginationBar /> : null}
              </>
            )}
          </DataGrid>
        </DataGridContainer>
      </CardContent>
    </Card>
  )
}

/** Хелпер для конвертации DataTableColumn<T> → ColumnDef<T> с DataGridColumnHeader. */
export function columnDefFromDataTable<T>(
  cols: DataTableColumn<T>[],
): ColumnDef<T, unknown>[] {
  return cols.map((c) => {
    const title = resolveHeaderTitle(c.header, c.headerTitle)
    const Icon = c.icon
    const sortable = c.sortable ?? Boolean(Icon)

    return {
      id: c.key,
      ...(sortable
        ? {
            accessorFn: c.sortValue
              ? (row: T) => c.sortValue!(row)
              : (row: T) => (row as Record<string, unknown>)[c.key] as string | number,
          }
        : {}),
      header: Icon
        ? ({ column }) => (
            <DataGridColumnHeader
              column={column}
              title={title}
              icon={<Icon />}
            />
          )
        : () => c.header,
      cell: ({ row }) => c.cell(row.original, row.index),
      enableSorting: sortable,
      meta: {
        headerTitle: title || undefined,
        cellClassName: c.className,
        headerClassName: c.headerClassName,
      },
    }
  })
}

/** re-export flexRender для удобства использования в колонках. */
export { flexRender }
