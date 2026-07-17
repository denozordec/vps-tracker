import type { ReactNode } from 'react'
import {
  Frame,
  FrameDescription,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from '@/components/reui/frame'
import { Skeleton } from '@cfdm/ui/components/skeleton'
import { PageHeader } from '@/components/page-header'
import { KpiStatGrid, type KpiStatCard } from './kpi-stat-grid'

export type OpsKpiCard = KpiStatCard

interface OpsDashboardProps {
  title?: string
  description?: string
  kpiCards: OpsKpiCard[]
  charts: ReactNode
  queue: ReactNode
  isLoading?: boolean
}

const rootClassName =
  'text-foreground @container flex w-full flex-col gap-2 md:gap-3'

function OpsDashboardSkeleton() {
  return (
    <div className={rootClassName}>
      <header className="px-1">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="mt-2 h-4 w-80 max-w-full" />
      </header>
      <KpiStatGrid cards={[]} isLoading skeletonCount={4} />
      <div className="grid gap-2 @3xl:grid-cols-2">
        <Skeleton className="h-64 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
      <Skeleton className="h-48 w-full rounded-xl" />
    </div>
  )
}

export function OpsDashboard({
  title = 'Панель управления',
  description = 'Обзор VPS, платежей, тарифов и синхронизации',
  kpiCards,
  charts,
  queue,
  isLoading = false,
}: OpsDashboardProps) {
  if (isLoading) {
    return <OpsDashboardSkeleton />
  }

  return (
    <div className={rootClassName}>
      <PageHeader title={title} description={description} />

      <section aria-label="Ключевые метрики">
        <KpiStatGrid cards={kpiCards} skeletonCount={4} />
      </section>

      <section
        aria-label="Аналитика"
        className="grid min-w-0 items-start gap-2 @3xl:grid-cols-2"
      >
        {charts}
      </section>

      <section aria-label="Требуют внимания">
        <Frame dense spacing="sm" className="w-full">
          <FrameHeader>
            <FrameTitle>Требуют внимания</FrameTitle>
            <FrameDescription>
              Проблемы оплаты, истекающие VPS и ошибки синхронизации
            </FrameDescription>
          </FrameHeader>
          <FramePanel>{queue}</FramePanel>
        </Frame>
      </section>
    </div>
  )
}
