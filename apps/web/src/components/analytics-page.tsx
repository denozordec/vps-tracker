import type { ReactNode } from 'react'
import { ServerIcon } from 'lucide-react'
import { PageShell } from './page-shell'
import { PageHeader } from './page-header'
import { QueryState } from './query-state'
import { EmptyState } from './empty-state'
import { SectionCardsSkeleton } from './skeletons'

interface AnalyticsPageProps<T> {
  title: string
  description?: string
  actions?: ReactNode
  data: T | undefined
  isLoading: boolean
  isError: boolean
  error?: unknown
  onRetry?: () => void
  /** Показать empty, если нет данных для аналитики (например, 0 VPS). */
  analyticsEmpty?: boolean
  emptyTitle?: string
  emptyDescription?: string
  emptyAction?: ReactNode
  skeleton?: ReactNode
  children: (data: T) => ReactNode
}

export function AnalyticsPage<T>({
  title,
  description,
  actions,
  data,
  isLoading,
  isError,
  error,
  onRetry,
  analyticsEmpty,
  emptyTitle = 'Нет данных для аналитики',
  emptyDescription = 'Добавьте VPS или дождитесь синхронизации с BILLmanager',
  emptyAction,
  skeleton,
  children,
}: AnalyticsPageProps<T>) {
  return (
    <PageShell>
      <PageHeader title={title} description={description} actions={actions} />
      <QueryState
        data={data}
        isLoading={isLoading}
        isError={isError}
        error={error}
        onRetry={onRetry}
        skeleton={skeleton ?? <SectionCardsSkeleton count={3} />}
      >
        {(snap) =>
          analyticsEmpty ? (
            <EmptyState
              icon={<ServerIcon className="size-8" />}
              title={emptyTitle}
              description={emptyDescription}
              action={emptyAction}
            />
          ) : (
            children(snap)
          )
        }
      </QueryState>
    </PageShell>
  )
}
