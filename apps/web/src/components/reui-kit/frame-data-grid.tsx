import { useState, useEffect, type ReactNode } from 'react'
import {
  useTable,
  flexRender,
  type ColumnDef,
  type SortingState,
  type RowSelectionState,
  type ColumnVisibilityState,
  type ExpandedState,
  type OnChangeFn,
  type PaginationState,
} from '@tanstack/react-table'
import { Columns3Icon } from 'lucide-react'

import { Button } from '@cfdm/ui/components/button'
import { cn } from '@cfdm/ui/lib/utils'
import {
  DataGrid,
  DataGridContainer,
  dataGridFeatures,
  type DataGridFeatures,
  type DataGridTableInstance,
} from '@/components/reui/data-grid/data-grid'
import {
  DataGridTable,
  DataGridTableRowExpand,
  DataGridTableRowSelect,
  DataGridTableRowSelectAll,
} from '@/components/reui/data-grid/data-grid-table'
import { DataGridTableVirtual } from '@/components/reui/data-grid/data-grid-table-virtual'
import { DataGridScrollArea } from '@/components/reui/data-grid/data-grid-scroll-area'
import { DataGridPagination } from '@/components/reui/data-grid/data-grid-pagination'
import { DataGridColumnHeader } from '@/components/reui/data-grid/data-grid-column-header'
import { DataGridColumnVisibility } from '@/components/reui/data-grid/data-grid-column-visibility'
import { EmptyState } from '@/components/empty-state'
import type { DataGridColumn } from '@/components/data-grid-types'
import {
  Frame,
  FrameDescription,
  FrameFooter,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from '@/components/reui/frame'

export type DataGridColumnDef<TData extends object> = ColumnDef<
  DataGridFeatures,
  TData
>

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

function loadStoredColumnVisibility(key: string): ColumnVisibilityState | undefined {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return undefined
    return JSON.parse(raw) as ColumnVisibilityState
  } catch {
    return undefined
  }
}

export { loadStoredColumnVisibility }

export interface DataGridColumnVisibilityOption {
  id: string
  label: string
}

export function dataGridColumnVisibilityOptions<T>(
  cols: DataGridColumn<T>[],
): DataGridColumnVisibilityOption[] {
  return cols
    .filter((c) => c.enableHiding !== false)
    .map((c) => ({
      id: c.key,
      label: c.headerTitle ?? (typeof c.header === 'string' ? c.header : c.key),
    }))
}

export interface FrameDataGridProps<TData extends object> {
  title?: ReactNode
  description?: ReactNode
  actions?: ReactNode
  columns: DataGridColumnDef<TData>[]
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
  /** Показать picker видимости колонок. */
  enableColumnVisibility?: boolean
  /** Управляемая видимость колонок (для внешнего UI, напр. тулбар «Вид»). */
  columnVisibility?: ColumnVisibilityState
  onColumnVisibilityChange?: OnChangeFn<ColumnVisibilityState>
  /** Показать встроенную кнопку «Колонки». По умолчанию true при enableColumnVisibility. */
  columnVisibilityTrigger?: boolean
  /** Ключ localStorage для сохранения видимости колонок. */
  columnVisibilityStorageKey?: string
  /** Начальная видимость колонок (перекрывает localStorage для отсутствующих ключей). */
  initialColumnVisibility?: ColumnVisibilityState
  className?: string
  /** Expandable rows — c-data-grid-8 / https://reui.io/preview/base/components/c-data-grid-8 */
  expandedContent?: (row: TData) => ReactNode
  getRowCanExpand?: (row: TData) => boolean
  /** Закрепить колонки слева (ids). Timesheet DNA: https://reui.io/preview/base/data-grid-base-4 */
  pinLeftColumnIds?: string[]
  /** Горизонтальный скролл широкой матрицы. */
  horizontalScroll?: boolean
}

function DataGridSectionHeader({
  title,
  description,
  actions,
}: {
  title?: ReactNode
  description?: ReactNode
  actions?: ReactNode
}) {
  if (!title && !description && !actions) return null

  return (
    <FrameHeader className="flex-row items-start justify-between gap-3">
      <div className="flex min-w-0 flex-col gap-px">
        {title ? <FrameTitle className="text-balance">{title}</FrameTitle> : null}
        {description ? (
          <FrameDescription className="text-xs text-pretty">{description}</FrameDescription>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">{actions}</div>
      ) : null}
    </FrameHeader>
  )
}

function DataGridPaginationBar() {
  return (
    <FrameFooter>
      <DataGridPagination {...PAGINATION_LABELS} />
    </FrameFooter>
  )
}

function FrameDataGridBody<TData extends object>({
  table,
  data,
  emptyTitle,
  onRowClick,
  dense,
  virtualization,
  height,
  footerContent,
  showPagination,
  enableColumnVisibility,
  columnsPinnable,
  horizontalScroll,
}: {
  table: DataGridTableInstance<TData>
  data: TData[]
  emptyTitle: string
  onRowClick?: (row: TData) => void
  dense: boolean
  virtualization: boolean
  height: number
  footerContent?: ReactNode
  showPagination: boolean
  enableColumnVisibility: boolean
  columnsPinnable: boolean
  horizontalScroll: boolean
}) {
  const tableNode = virtualization ? (
    <DataGridTableVirtual height={height} footerContent={footerContent} />
  ) : (
    <DataGridTable footerContent={footerContent} />
  )

  return (
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
        columnsVisibility: enableColumnVisibility,
        columnsResizable: false,
        columnsPinnable,
        columnsMovable: false,
        rowsDraggable: false,
        rowsPinnable: false,
      }}
      tableClassNames={{
        header: 'text-xs font-medium text-muted-foreground',
      }}
    >
      <DataGridContainer border={false}>
        {virtualization || horizontalScroll ? (
          <DataGridScrollArea
            orientation={virtualization && horizontalScroll ? 'both' : virtualization ? 'vertical' : 'both'}
            style={virtualization ? { height } : { maxHeight: 'min(70vh, 40rem)' }}
          >
            {tableNode}
          </DataGridScrollArea>
        ) : (
          tableNode
        )}
      </DataGridContainer>
      {showPagination ? <DataGridPaginationBar /> : null}
    </DataGrid>
  )
}

export function FrameDataGrid<TData extends object>({
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
  enableColumnVisibility = false,
  columnVisibility: columnVisibilityProp,
  onColumnVisibilityChange,
  columnVisibilityTrigger,
  columnVisibilityStorageKey,
  initialColumnVisibility,
  className,
  expandedContent,
  getRowCanExpand,
  pinLeftColumnIds,
  horizontalScroll = false,
}: FrameDataGridProps<TData>) {
  const showPagination = pagination ?? true
  const [sorting, setSorting] = useState<SortingState>(initialSorting ?? [])
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const [expanded, setExpanded] = useState<ExpandedState>({})
  const [paginationState, setPaginationState] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: showPagination ? pageSize : Number.POSITIVE_INFINITY,
  })
  const [internalColumnVisibility, setInternalColumnVisibility] = useState<ColumnVisibilityState>(() => {
    const stored = columnVisibilityStorageKey
      ? loadStoredColumnVisibility(columnVisibilityStorageKey)
      : undefined
    return { ...initialColumnVisibility, ...stored }
  })

  const isColumnVisibilityControlled = columnVisibilityProp !== undefined
  const columnVisibility = isColumnVisibilityControlled ? columnVisibilityProp : internalColumnVisibility
  const setColumnVisibility: OnChangeFn<ColumnVisibilityState> = isColumnVisibilityControlled
    ? (onColumnVisibilityChange ?? (() => undefined))
    : setInternalColumnVisibility

  useEffect(() => {
    setPaginationState((current) => ({
      pageIndex: showPagination ? current.pageIndex : 0,
      pageSize: showPagination ? pageSize : Number.POSITIVE_INFINITY,
    }))
  }, [pageSize, showPagination])

  useEffect(() => {
    if (isColumnVisibilityControlled || !columnVisibilityStorageKey) return
    localStorage.setItem(columnVisibilityStorageKey, JSON.stringify(columnVisibility))
  }, [columnVisibility, columnVisibilityStorageKey, isColumnVisibilityControlled])

  const selectColumn: DataGridColumnDef<TData> = {
    id: 'select',
    header: () => <DataGridTableRowSelectAll />,
    cell: ({ row }) => <DataGridTableRowSelect row={row} />,
    enableSorting: false,
    enableHiding: false,
    size: 40,
    meta: { cellClassName: 'w-10' },
  }

  const expandColumn: DataGridColumnDef<TData> = {
    id: 'expand',
    header: () => null,
    cell: ({ row }) => <DataGridTableRowExpand row={row} />,
    enableSorting: false,
    enableHiding: false,
    size: 40,
    meta: {
      cellClassName: 'w-10',
      expandedContent,
    },
  }

  const tableColumns: DataGridColumnDef<TData>[] = [
    ...(expandedContent ? [expandColumn] : []),
    ...(enableRowSelection ? [selectColumn] : []),
    ...columns,
  ]

  const lastColId = pinLastColumn ? tableColumns[tableColumns.length - 1]?.id ?? '' : ''
  const pinLeft = pinLeftColumnIds ?? []
  const enablePinning = pinLastColumn || pinLeft.length > 0
  const columnPinning = {
    start: pinLeft,
    end: pinLastColumn && lastColId ? [lastColId] : [],
  }

  const table = useTable({
    features: dataGridFeatures,
    data,
    columns: tableColumns,
    state: {
      sorting,
      pagination: paginationState,
      columnVisibility,
      expanded,
      ...(enablePinning ? { columnPinning } : {}),
      ...(enableRowSelection ? { rowSelection } : {}),
    },
    onSortingChange: setSorting,
    onPaginationChange: setPaginationState,
    onExpandedChange: setExpanded,
    onColumnVisibilityChange: setColumnVisibility,
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
    initialState: enablePinning ? { columnPinning } : undefined,
    getRowId: rowId ? (row, index) => rowId(row, index) : undefined,
    getRowCanExpand: expandedContent
      ? (row) => (getRowCanExpand ? getRowCanExpand(row.original) : true)
      : undefined,
    enableRowSelection,
    enableHiding: enableColumnVisibility,
  })

  const showColumnVisibilityTrigger =
    enableColumnVisibility && (columnVisibilityTrigger ?? true)

  const columnVisibilityAction = showColumnVisibilityTrigger ? (
    <DataGridColumnVisibility
      table={table}
      trigger={
        <Button variant="ghost" size="sm">
          <Columns3Icon data-icon="inline-start" />
          Колонки
        </Button>
      }
    />
  ) : null

  const headerActions = actions ? (
    <div className="flex items-center gap-2">
      {columnVisibilityAction}
      {actions}
    </div>
  ) : (
    columnVisibilityAction
  )

  const hasHeader = Boolean(title || description || actions || showColumnVisibilityTrigger)

  if (data.length === 0) {
    return (
      <Frame dense variant="default" spacing="sm" className={cn('w-full', className)}>
        {hasHeader ? (
          <DataGridSectionHeader title={title} description={description} actions={headerActions} />
        ) : null}
        <FramePanel className="flex min-h-72 w-full flex-col items-center justify-center">
          <EmptyState title={emptyTitle} description={emptyDescription} action={emptyAction} />
        </FramePanel>
      </Frame>
    )
  }

  const gridBody = (
    <FrameDataGridBody
      table={table}
      data={data}
      emptyTitle={emptyTitle}
      onRowClick={onRowClick}
      dense={dense}
      virtualization={virtualization}
      height={height}
      footerContent={footerContent}
      showPagination={showPagination}
      enableColumnVisibility={enableColumnVisibility}
      columnsPinnable={enablePinning}
      horizontalScroll={horizontalScroll}
    />
  )

  return (
    <Frame dense variant="default" spacing="sm" className={cn('w-full', className)}>
      {hasHeader ? (
        <DataGridSectionHeader title={title} description={description} actions={headerActions} />
      ) : null}
      <FramePanel className="p-0 shadow-none!">{gridBody}</FramePanel>
    </Frame>
  )
}

/** Хелпер для конвертации DataGridColumn<T> → ColumnDef<T> с DataGridColumnHeader. */
export function columnDefFromDataGrid<T extends object>(
  cols: DataGridColumn<T>[],
): DataGridColumnDef<T>[] {
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
            sortFn: c.sortingFn ?? 'auto',
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
      enableHiding: c.enableHiding ?? true,
      enablePinning: c.enablePinning,
      size: c.size,
      minSize: c.minSize,
      maxSize: c.maxSize,
      meta: {
        headerTitle: title || undefined,
        cellClassName: c.className,
        headerClassName: c.headerClassName,
      },
    }
  })
}

/** @deprecated Используйте columnDefFromDataGrid */
export const columnDefFromDataTable = columnDefFromDataGrid

/** re-export flexRender для удобства использования в колонках. */
export { flexRender }
