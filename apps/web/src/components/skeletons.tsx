import { Skeleton } from '@cfdm/ui/components/skeleton'
import { Frame, FramePanel } from '@/components/reui/frame'
import { cn } from '@cfdm/ui/lib/utils'

/** KPI skeleton — hybrid stats-12 layout. */
export function KpiStatGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <Frame className="@container w-full">
      <div
        className={cn(
          'grid gap-2',
          count <= 1
            ? 'grid-cols-1'
            : count === 2
              ? 'grid-cols-1 @xl:grid-cols-2'
              : count === 3
                ? 'grid-cols-1 @3xl:grid-cols-3'
                : 'grid-cols-1 @3xl:grid-cols-2 @6xl:grid-cols-4',
        )}
      >
        {Array.from({ length: count }).map((_, index) => (
          <FramePanel key={index} className="flex items-start gap-3">
            <Skeleton className="size-10.5 shrink-0 rounded-lg" />
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <div className="flex items-center justify-between gap-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4.5 w-14 rounded-full" />
              </div>
              <Skeleton className="h-7 w-16" />
            </div>
          </FramePanel>
        ))}
      </div>
    </Frame>
  )
}

export function TableSkeleton({ rows = 6, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <Frame dense spacing="sm" className="w-full">
      <FramePanel className="p-0">
        <div className="flex flex-col">
          <div className="flex gap-2 border-b p-3">
            {Array.from({ length: cols }).map((_, i) => (
              <Skeleton className="h-4 flex-1" key={`h-${i}`} />
            ))}
          </div>
          {Array.from({ length: rows }).map((_, r) => (
            <div className="flex gap-2 border-b p-3" key={`r-${r}`}>
              {Array.from({ length: cols }).map((_, c) => (
                <Skeleton className="h-4 flex-1" key={`c-${r}-${c}`} />
              ))}
            </div>
          ))}
        </div>
      </FramePanel>
    </Frame>
  )
}

/** @deprecated Use KpiStatGridSkeleton */
export const SectionCardsSkeleton = KpiStatGridSkeleton
