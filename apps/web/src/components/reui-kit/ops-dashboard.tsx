import type { ReactNode } from 'react'
import { Skeleton } from '@cfdm/ui/components/skeleton'
import { PageHeader } from '@/components/page-header'
import { KpiStatGrid, type KpiStatCard } from './kpi-stat-grid'

export type OpsKpiCard = KpiStatCard

interface OpsDashboardProps {
  title?: string
  description?: string
  kpiCards: OpsKpiCard[]
  /** Alert between the page header and KPI (design order: title → banner → KPI → tabs). */
  banner?: ReactNode
  /** Page body after KPI — design «VPS-Tracker»: line tabs (Проблемы / Последние VPS / Аккаунты). */
  children: ReactNode
  isLoading?: boolean
}

const rootClassName =
  'text-foreground @container flex w-full flex-col gap-4 md:gap-6'

function OpsDashboardSkeleton() {
  return (
    <div className={rootClassName}>
      <header className="px-1">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="mt-2 h-4 w-80 max-w-full" />
      </header>
      <KpiStatGrid cards={[]} isLoading skeletonCount={4} />
      <div className="grid w-full gap-2 lg:grid-cols-2">
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
  banner,
  children,
  isLoading = false,
}: OpsDashboardProps) {
  if (isLoading) {
    return <OpsDashboardSkeleton />
  }

  return (
    <div className={rootClassName}>
      <PageHeader title={title} description={description} />

      {banner}

      <section aria-label="Ключевые метрики">
        <KpiStatGrid cards={kpiCards} skeletonCount={4} />
      </section>

      {children}
    </div>
  )
}
