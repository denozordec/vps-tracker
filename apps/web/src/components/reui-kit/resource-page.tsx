import { useCallback, useMemo, useState, type ReactNode } from 'react'
import {
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type PaginationState,
  type RowSelectionState,
  type SortingState,
} from '@tanstack/react-table'
import { CircleAlertIcon, FilterIcon, FilterXIcon } from 'lucide-react'

import { CountedLineTabs } from '@/components/counted-line-tabs'
import { Badge } from '@/components/reui/badge'
import { DataGrid } from '@/components/reui/data-grid/data-grid'
import { DataGridPagination } from '@/components/reui/data-grid/data-grid-pagination'
import { DataGridScrollArea } from '@/components/reui/data-grid/data-grid-scroll-area'
import { DataGridTable } from '@/components/reui/data-grid/data-grid-table'
import {
  Filters,
  type Filter,
  type FilterFieldConfig,
} from '@/components/reui/filters'
import {
  Frame,
  FrameDescription,
  FrameFooter,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from '@/components/reui/frame'
import { Button } from '@cfdm/ui/components/button'
import { Separator } from '@cfdm/ui/components/separator'
import { Skeleton } from '@cfdm/ui/components/skeleton'
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/reui/alert'
import { EmptyState } from '@/components/empty-state'
import { applyFiltersToData } from './filter-utils'

export interface ResourcePageTab {
  id: string
  label: string
  count?: number
}

export interface ResourcePageProps<T extends object> {
  title: string
  description?: string
  tabs?: ResourcePageTab[]
  activeTab?: string
  onTabChange?: (tabId: string) => void
  tabFilter?: (item: T, tabId: string) => boolean
  filterFields: FilterFieldConfig[]
  filters: Filter[]
  onFiltersChange: (filters: Filter[]) => void
  onClearFilters?: () => void
  getFilterFieldValue: (item: T, field: string) => unknown
  columns: ColumnDef<T, unknown>[]
  data: T[]
  getRowId: (row: T) => string
  isLoading?: boolean
  isError?: boolean
  error?: Error | null
  onRetry?: () => void
  primaryAction?: ReactNode
  emptyState?: { title: string; description?: string; action?: ReactNode }
  pageSize?: number
  enableRowSelection?: boolean
  selectionToolbar?: (ctx: {
    selectedIds: string[]
    selectedCount: number
    clearSelection: () => void
  }) => ReactNode
  toolbarExtra?: ReactNode
  hideHeader?: boolean
}

function ResourcePageSkeleton() {
  return (
    <Frame dense variant="default" spacing="sm" className="w-full">
      <FrameHeader>
        <Skeleton className="h-5 w-48" />
        <Skeleton className="mt-1 h-4 w-72" />
      </FrameHeader>
      <FramePanel className="p-0">
        <div className="flex flex-col gap-3 p-4">
          <Skeleton className="h-9 w-full max-w-md" />
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      </FramePanel>
    </Frame>
  )
}

export function ResourcePage<T extends object>({
  title,
  description,
  tabs,
  activeTab: controlledTab,
  onTabChange,
  tabFilter,
  filterFields,
  filters,
  onFiltersChange,
  onClearFilters,
  getFilterFieldValue,
  columns,
  data,
  getRowId,
  isLoading = false,
  isError = false,
  error = null,
  onRetry,
  primaryAction,
  emptyState,
  pageSize = 10,
  enableRowSelection = false,
  selectionToolbar,
  toolbarExtra,
  hideHeader = false,
}: ResourcePageProps<T>) {
  const [internalTab, setInternalTab] = useState(tabs?.[0]?.id ?? 'all')
  const activeTab = controlledTab ?? internalTab

  const [sorting, setSorting] = useState<SortingState>([])
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize,
  })

  const resetPagination = useCallback(() => {
    setPagination((current) =>
      current.pageIndex === 0 ? current : { ...current, pageIndex: 0 },
    )
  }, [])

  const filteredData = useMemo(() => {
    let result = applyFiltersToData(data, filters, getFilterFieldValue)
    if (tabs && tabs.length > 0 && tabFilter && activeTab !== 'all') {
      result = result.filter((item) => tabFilter(item, activeTab))
    }
    return result
  }, [data, filters, getFilterFieldValue, tabs, tabFilter, activeTab])

  const tabCounts = useMemo(() => {
    if (!tabs?.length || !tabFilter) return {}
    const base = applyFiltersToData(data, filters, getFilterFieldValue)
    const counts: Record<string, number> = {}
    for (const tab of tabs) {
      counts[tab.id] =
        tab.id === 'all'
          ? base.length
          : base.filter((item) => tabFilter(item, tab.id)).length
    }
    return counts
  }, [tabs, tabFilter, data, filters, getFilterFieldValue])

  const selectedIds = useMemo(
    () => Object.keys(rowSelection).filter((id) => rowSelection[id]),
    [rowSelection],
  )

  const selectedCount = selectedIds.length

  const clearSelection = useCallback(() => {
    setRowSelection({})
  }, [])

  const table = useReactTable({
    data: filteredData,
    columns,
    getRowId,
    state: { sorting, rowSelection, pagination },
    enableRowSelection,
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  })

  const handleTabChange = useCallback(
    (value: string) => {
      if (onTabChange) onTabChange(value)
      else setInternalTab(value)
      resetPagination()
    },
    [onTabChange, resetPagination],
  )

  const handleFiltersChange = useCallback(
    (next: Filter[]) => {
      onFiltersChange(next)
      resetPagination()
    },
    [onFiltersChange, resetPagination],
  )

  const handleClear = useCallback(() => {
    onClearFilters?.()
    resetPagination()
  }, [onClearFilters, resetPagination])

  const countedTabs = useMemo(
    () =>
      (tabs ?? []).map((tab) => ({
        id: tab.id,
        label: tab.label,
        count: tabCounts[tab.id] ?? tab.count ?? 0,
      })),
    [tabs, tabCounts],
  )

  if (isLoading) {
    return <ResourcePageSkeleton />
  }

  if (isError) {
    return (
      <Alert variant="destructive">
        <CircleAlertIcon />
        <AlertTitle>Ошибка загрузки</AlertTitle>
        <AlertDescription className="flex flex-col gap-2">
          <span>{error?.message ?? 'Не удалось загрузить данные'}</span>
          {onRetry ? (
            <Button type="button" variant="outline" size="sm" onClick={onRetry}>
              Повторить
            </Button>
          ) : null}
        </AlertDescription>
      </Alert>
    )
  }

  if (data.length === 0 && emptyState) {
    return (
      <EmptyState
        title={emptyState.title}
        description={emptyState.description}
        action={emptyState.action}
      />
    )
  }

  const emptyMessage = 'Нет записей по выбранным фильтрам.'

  return (
    <div className="w-full">
    {selectionToolbar && selectedCount > 0
      ? selectionToolbar({
          selectedIds,
          selectedCount,
          clearSelection,
        })
      : null}
    <DataGrid
      table={table}
      recordCount={filteredData.length}
      emptyMessage={emptyMessage}
      tableLayout={{ dense: true }}
    >
      <Frame dense variant="default" spacing="sm" className="w-full">
        {!hideHeader ? (
          <FrameHeader className="flex-row items-start justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-px">
              <FrameTitle className="text-balance">{title}</FrameTitle>
              {description ? (
                <FrameDescription className="flex flex-wrap items-center gap-1.5 text-xs text-pretty">
                  <span>{description}</span>
                  <span
                    className="bg-input size-1 shrink-0 rounded-full"
                    aria-hidden="true"
                  />
                  <span className="tabular-nums">
                    {filteredData.length} записей
                  </span>
                  {selectedCount > 0 ? (
                    <>
                      <span
                        className="bg-input size-1 shrink-0 rounded-full"
                        aria-hidden="true"
                      />
                      <span>{selectedCount} выбрано</span>
                    </>
                  ) : null}
                </FrameDescription>
              ) : null}
            </div>
            {primaryAction ? (
              <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                {primaryAction}
              </div>
            ) : null}
          </FrameHeader>
        ) : null}

        <FramePanel className="p-0 shadow-none!">
          {countedTabs.length > 0 ? (
            <>
              <div className="px-(--frame-panel-header-px) pt-(--frame-panel-header-py)">
                <CountedLineTabs
                  tabs={countedTabs}
                  value={activeTab}
                  onValueChange={handleTabChange}
                />
              </div>
              <Separator />
            </>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-3 px-(--frame-panel-header-px) py-(--frame-panel-header-py)">
            <Filters
              filters={filters}
              fields={filterFields}
              onChange={handleFiltersChange}
              size="default"
              trigger={
                <Button type="button" variant="outline" aria-label="Фильтры">
                  <FilterIcon className="size-4" aria-hidden="true" />
                  Фильтры
                </Button>
              }
            />
            <div className="flex flex-wrap items-center justify-end gap-2">
              {toolbarExtra}
              {selectedCount > 0 ? (
                <Badge size="sm" variant="secondary">
                  {selectedCount} выбрано
                </Badge>
              ) : null}
              {onClearFilters ? (
                <Button type="button" variant="outline" onClick={handleClear}>
                  <FilterXIcon className="size-4" aria-hidden="true" />
                  Сбросить
                </Button>
              ) : null}
            </div>
          </div>

          <Separator />

          <DataGridScrollArea>
            <DataGridTable />
          </DataGridScrollArea>

          <Separator />

          <FrameFooter>
            <DataGridPagination
              sizes={[5, 10, 20, 50]}
              rowsPerPageLabel="Строк на странице"
              info="{from} - {to} of {count}"
              previousPageLabel="Предыдущая"
              nextPageLabel="Следующая"
            />
          </FrameFooter>
        </FramePanel>
      </Frame>
    </DataGrid>
    </div>
  )
}
