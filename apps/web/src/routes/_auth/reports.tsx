import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { DownloadIcon, TrendingUpIcon, CreditCardIcon, ServerIcon } from 'lucide-react'
import { z } from 'zod'

import { snapshotQueryOptions, ratesQueryOptions } from '@/queries/snapshot'
import { Button } from '@cfdm/ui/components/button'
import { AnalyticsPage } from '@/components/analytics-page'
import { SectionCards } from '@/components/section-cards'
import { EmptyState } from '@/components/empty-state'
import {
  ChartsGrid,
  MonthlyExpenseChart,
  PaymentsPieChart,
  MonthlyTrendChart,
  ProjectExpenseChart,
} from '@/components/domain/charts'
import {
  ReportsFiltersToolbar,
  buildDefaultReportsFilters,
  hasActiveReportsFilters,
  type ReportsFiltersState,
} from '@/components/reports-filters-toolbar'
import { exportVpsCsv } from '@/lib/export-csv'
import { formatCurrency, normalizeRatesPayload } from '@/lib/format'
import {
  filterPaymentsByPeriod,
  filterPaymentsByProjectKeys,
  filterVpsByProjectKeys,
  paymentsInTrendWindow,
  projectKeysFromSearch,
  sumVpsMonthlyBurn,
  type ReportsPeriod,
} from '@/lib/project-analytics'

const reportsSearchSchema = z.object({
  project: z.union([z.string(), z.array(z.string())]).optional(),
  period: z.enum(['3m', '6m', '12m', 'all']).optional(),
})

export const Route = createFileRoute('/_auth/reports')({
  validateSearch: (search) => reportsSearchSchema.parse(search),
  loader: ({ context: { queryClient } }) =>
    queryClient.ensureQueryData(snapshotQueryOptions()),
  component: ReportsPage,
})

function ReportsPage() {
  const search = Route.useSearch()
  const { data: snapshot, isLoading, isError, error, refetch } = useQuery(snapshotQueryOptions())
  const settings = snapshot?.settings?.[0]
  const { data: rawRates } = useQuery(ratesQueryOptions(settings?.ratesUrl))
  const ratesData = normalizeRatesPayload(rawRates) ?? rawRates ?? null
  const [filters, setFilters] = useState<ReportsFiltersState>(buildDefaultReportsFilters())

  const projects = snapshot?.serverProjects ?? []

  useEffect(() => {
    const keys = projectKeysFromSearch(search.project, projects)
    setFilters({
      projectKeys: keys,
      period: (search.period as ReportsPeriod) ?? '12m',
    })
  }, [search.project, search.period, projects])

  const filteredVps = useMemo(() => {
    if (!snapshot) return []
    return filterVpsByProjectKeys(snapshot.vps, filters.projectKeys, projects)
  }, [snapshot, filters.projectKeys, projects])

  const filteredPayments = useMemo(() => {
    if (!snapshot) return []
    const byProject = filterPaymentsByProjectKeys(
      snapshot.payments,
      new Map(snapshot.vps.map((v) => [v.id, v])),
      filters.projectKeys,
      projects,
    )
    return filterPaymentsByPeriod(byProject, filters.period)
  }, [snapshot, filters.projectKeys, filters.period, projects])

  const trendPayments = useMemo(
    () => paymentsInTrendWindow(filteredPayments, filters.period),
    [filteredPayments, filters.period],
  )

  const exportCsv = () => {
    if (!snapshot) return
    const suffix =
      filters.projectKeys.length === 1
        ? `-${projects.find((p) => p.id === filters.projectKeys[0])?.name ?? 'project'}`
        : filters.projectKeys.length > 1
          ? '-filtered'
          : ''
    exportVpsCsv(
      filteredVps.map((v) => ({
        ip: v.ip,
        project: v.project ?? '',
        status: v.status,
        vcpu: v.vcpu,
        ramGb: v.ramGb,
        diskGb: v.diskGb,
        monthlyRate: v.monthlyRate ?? 0,
        currency: v.currency,
      })),
      `vps-report${suffix}.csv`,
    )
  }

  const filterActive = hasActiveReportsFilters(filters)
  const zeroResults = Boolean(snapshot && snapshot.vps.length > 0 && filteredVps.length === 0 && filterActive)

  return (
    <AnalyticsPage
      title="Отчёты"
      description="Расходы, платежи и динамика в разрезе проектов"
      actions={
        <Button variant="outline" onClick={exportCsv} disabled={!snapshot || filteredVps.length === 0}>
          <DownloadIcon data-icon="inline-start" />
          Экспорт CSV
        </Button>
      }
      data={snapshot}
      isLoading={isLoading}
      isError={isError}
      error={error}
      onRetry={() => refetch()}
      analyticsEmpty={snapshot?.vps.length === 0}
      emptyAction={
        <Button variant="outline" render={<Link to="/vps" />}>
          Перейти к VPS
        </Button>
      }
    >
      {(snap) => {
        const baseCurrency = (snap.settings[0]?.baseCurrency ?? 'RUB').toUpperCase()
        const analyticsCtx = {
          providers: snap.providers,
          settings: snap.settings,
          ratesData,
        }
        const monthly = sumVpsMonthlyBurn(
          filteredVps.filter((v) => v.status === 'active'),
          analyticsCtx,
        )
        const expenseTitle =
          filters.projectKeys.length > 0
            ? 'Расходы по хостерам (в рамках фильтра)'
            : 'Расходы по хостерам (мес)'

        if (zeroResults) {
          return (
            <>
              <ReportsFiltersToolbar
                filters={filters}
                onChange={setFilters}
                projects={projects}
                shownVps={0}
                totalVps={snap.vps.length}
              />
              <EmptyState
                title="Нет данных по фильтру"
                description="Выберите другие проекты или сбросьте фильтры"
                action={
                  <Button variant="outline" onClick={() => setFilters(buildDefaultReportsFilters())}>
                    Сбросить фильтры
                  </Button>
                }
              />
            </>
          )
        }

        return (
          <>
            <ReportsFiltersToolbar
              filters={filters}
              onChange={setFilters}
              projects={projects}
              shownVps={filteredVps.length}
              totalVps={snap.vps.length}
            />
            <SectionCards
              items={[
                {
                  label: 'Расход/мес',
                  value: formatCurrency(monthly, baseCurrency),
                  icon: <TrendingUpIcon className="size-4" />,
                  hint:
                    filters.projectKeys.length > 0
                      ? `в ${baseCurrency}, по фильтру`
                      : `в ${baseCurrency}`,
                },
                {
                  label: 'Платежей',
                  value: filteredPayments.length,
                  icon: <CreditCardIcon className="size-4" />,
                  hint:
                    filters.projectKeys.length > 0
                      ? 'только с привязкой к VPS проекта'
                      : undefined,
                },
                {
                  label: 'Активных VPS',
                  value: filteredVps.filter((v) => v.status === 'active').length,
                  icon: <ServerIcon className="size-4" />,
                  hint: `из ${filteredVps.length}`,
                },
              ]}
            />
            <ChartsGrid>
              <ProjectExpenseChart
                vps={filteredVps}
                projects={projects}
                providers={snap.providers}
                settings={snap.settings}
                ratesData={ratesData}
              />
              <MonthlyExpenseChart
                vps={filteredVps}
                providers={snap.providers}
                providerAccounts={snap.providerAccounts}
                settings={snap.settings}
                ratesData={ratesData}
                title={expenseTitle}
              />
              <PaymentsPieChart
                payments={filteredPayments}
                settings={snap.settings}
                ratesData={ratesData}
              />
              <MonthlyTrendChart
                payments={trendPayments}
                settings={snap.settings}
                ratesData={ratesData}
                className="lg:col-span-2"
              />
            </ChartsGrid>
          </>
        )
      }}
    </AnalyticsPage>
  )
}
