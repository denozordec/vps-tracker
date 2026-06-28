import { useState, type ReactNode } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type RowSelectionState,
} from '@tanstack/react-table'

import { Card, CardContent, CardHeader, CardTitle } from '@cfdm/ui/components/card'
import { Checkbox } from '@cfdm/ui/components/checkbox'
import { cn } from '@cfdm/ui/lib/utils'
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
import type { DataTableColumn } from './data-grid-types'

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
  /** Включить выбор строк (чекбоксы). */
  enableRowSelection?: boolean
  /** Callback при изменении выбора. */
  onRowSelectionChange?: (selectedIds: string[]) => void
  className?: string
}

function DataGridPaginationBar() {
  return (
    <div className="px-4 py-2.5">
      <DataGridPagination {...PAGINATION_LABELS} />
    </div>
  )
}

function DataGridCardBody<TData extends object>({
  table,
  data,
  emptyTitle,
  onRowClick,
  dense,
  virtualization,
  height,
  footerContent,
  showPagination,
}: {
  table: ReturnType<typeof useReactTable<TData>>
  data: TData[]
  emptyTitle: string
  onRowClick?: (row: TData) => void
  dense: boolean
  virtualization: boolean
  height: number
  footerContent?: ReactNode
  showPagination: boolean
}) {
  return (
    <DataGridContainer border={false}>
      <DataGrid
        table={table}
        recordCount={data.length}
        onRowClick={onRowClick}
        emptyMessage={emptyTitle}
        tableLayout={{
          dense,
          stripped: true,
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
        tableClassNames={{
          header: 'text-xs font-medium text-muted-foreground',
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
  dense = true,
  pinLastColumn = false,
  initialSorting,
  virtualization = false,
  height = 480,
  enableRowSelection = false,
  onRowSelectionChange,
  className,
}: DataGridCardProps<TData>) {
  const [sorting, setSorting] = useState<SortingState>(initialSorting ?? [])
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})

  const selectColumn: ColumnDef<TData, unknown> = {
    id: 'select',
    header: ({ table }) => (
      <Checkbox
        checked={table.getIsAllPageRowsSelected()}
        indeterminate={table.getIsSomePageRowsSelected() && !table.getIsAllPageRowsSelected()}
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Выбрать все"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label="Выбрать строку"
        onClick={(e) => e.stopPropagation()}
      />
    ),
    enableSorting: false,
    meta: { cellClassName: 'w-10' },
  }

  const tableColumns = enableRowSelection ? [selectColumn, ...columns] : columns

  const lastColId = pinLastColumn ? tableColumns[tableColumns.length - 1]?.id ?? '' : ''

  const showPagination = pagination ?? true

  const table = useReactTable<TData>({
    data,
    columns: tableColumns,
    state: { sorting, ...(enableRowSelection ? { rowSelection } : {}) },
    onSortingChange: setSorting,
    onRowSelectionChange: enableRowSelection
      ? (updater) => {
          setRowSelection((prev) => {
            const next = typeof updater === 'function' ? updater(prev) : updater
            if (onRowSelectionChange && rowId) {
              const ids = Object.keys(next).filter((k) => next[k])
              onRowSelectionChange(ids)
            }
            return next
          })
        }
      : undefined,
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
    enableRowSelection,
  })

  const hasHeader = Boolean(title || description || actions)

  if (data.length === 0) {
    if (!hasHeader) {
      return (
        <div className={className}>
          <EmptyState title={emptyTitle} description={emptyDescription} action={emptyAction} />
        </div>
      )
    }

    return (
      <Card className={cn('ring-0 shadow-none', className)}>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <div className="flex flex-col gap-1">
            {title ? <CardTitle>{title}</CardTitle> : null}
            {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
          </div>
          {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
        </CardHeader>
        <CardContent>
          <EmptyState title={emptyTitle} description={emptyDescription} action={emptyAction} />
        </CardContent>
      </Card>
    )
  }

  const gridBody = (
    <DataGridCardBody
      table={table}
      data={data}
      emptyTitle={emptyTitle}
      onRowClick={onRowClick}
      dense={dense}
      virtualization={virtualization}
      height={height}
      footerContent={footerContent}
      showPagination={showPagination}
    />
  )

  if (!hasHeader) {
    return <div className={className}>{gridBody}</div>
  }

  return (
    <Card className={cn('ring-0 shadow-none', className)}>
        <CardHeader className="flex flex-row items-center justify-between gap-2 border-b border-border/50 pb-4">
        <div className="flex flex-col gap-1">
          {title ? <CardTitle>{title}</CardTitle> : null}
          {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
        </div>
        {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
      </CardHeader>
      <CardContent className="p-0 pt-2">{gridBody}</CardContent>
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
