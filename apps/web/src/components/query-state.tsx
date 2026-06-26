import type { ReactNode } from 'react'
import { AlertCircle, RefreshCwIcon } from 'lucide-react'
import { Button } from '@cfdm/ui/components/button'
import { Skeleton } from '@cfdm/ui/components/skeleton'
import { EmptyState } from './empty-state'

interface QueryStateProps<T> {
  data: T | undefined
  isLoading: boolean
  isError: boolean
  error?: unknown
  empty?: boolean
  emptyTitle?: string
  emptyDescription?: string
  emptyAction?: ReactNode
  onRetry?: () => void
  skeleton?: ReactNode
  children: (data: T) => ReactNode
}

export function QueryState<T>({
  data,
  isLoading,
  isError,
  error,
  empty,
  emptyTitle = 'Нет данных',
  emptyDescription,
  emptyAction,
  onRetry,
  skeleton,
  children,
}: QueryStateProps<T>) {
  if (isLoading) {
    return <>{skeleton ?? <DefaultSkeleton />}</>
  }
  if (isError) {
    return (
      <EmptyState
        icon={<AlertCircle className="size-8" />}
        title="Ошибка загрузки"
        description={error instanceof Error ? error.message : 'Не удалось загрузить данные'}
        action={
          onRetry ? (
            <Button variant="outline" size="sm" onClick={onRetry}>
              <RefreshCwIcon data-icon="inline-start" />
              Повторить
            </Button>
          ) : null
        }
      />
    )
  }
  if (empty || data == null) {
    return <EmptyState title={emptyTitle} description={emptyDescription} action={emptyAction} />
  }
  return <>{children(data)}</>
}

function DefaultSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-32 w-full" />
    </div>
  )
}
