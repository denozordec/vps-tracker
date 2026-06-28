import type { ReactNode } from 'react'
import { PageShell } from './page-shell'
import { PageHeader } from './page-header'
import { QueryState } from './query-state'
import { TableSkeleton } from './skeletons'

interface CrudListPageProps<T> {
  title: string
  description?: string
  actions?: ReactNode
  data: T | undefined
  isLoading: boolean
  isError: boolean
  error?: unknown
  onRetry?: () => void
  empty?: boolean
  emptyTitle?: string
  emptyDescription?: string
  emptyAction?: ReactNode
  skeleton?: ReactNode
  sheet?: ReactNode
  children: (data: T) => ReactNode
}

export function CrudListPage<T>({
  title,
  description,
  actions,
  data,
  isLoading,
  isError,
  error,
  onRetry,
  empty,
  emptyTitle,
  emptyDescription,
  emptyAction,
  skeleton,
  sheet,
  children,
}: CrudListPageProps<T>) {
  return (
    <PageShell>
      <PageHeader title={title} description={description} actions={actions} />
      <QueryState
        data={data}
        isLoading={isLoading}
        isError={isError}
        error={error}
        onRetry={onRetry}
        skeleton={skeleton ?? <TableSkeleton />}
        empty={empty}
        emptyTitle={emptyTitle}
        emptyDescription={emptyDescription}
        emptyAction={emptyAction}
      >
        {children}
      </QueryState>
      {sheet}
    </PageShell>
  )
}
