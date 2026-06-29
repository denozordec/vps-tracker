import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { DownloadIcon, TrendingUpIcon, CreditCardIcon, ServerIcon } from 'lucide-react'

import { snapshotQueryOptions, ratesQueryOptions } from '@/queries/snapshot'
import { Button } from '@cfdm/ui/components/button'
import { AnalyticsPage } from '@/components/analytics-page'
import { SectionCards } from '@/components/section-cards'
import { ChartsGrid, MonthlyExpenseChart, PaymentsPieChart, MonthlyTrendChart } from '@/components/domain/charts'
import { exportVpsCsv } from '@/lib/export-csv'

import { convertVpsMonthlyBurnToBase, formatCurrency, normalizeRatesPayload } from '@/lib/format'
import { providerByIdMap } from '@/lib/billmanager'

export const Route = createFileRoute('/_auth/reports')({
  loader: ({ context: { queryClient } }) =>
    queryClient.ensureQueryData(snapshotQueryOptions()),
  component: ReportsPage,
})

function ReportsPage() {
  const { data: snapshot, isLoading, isError, error, refetch } = useQuery(snapshotQueryOptions())
  const settings = snapshot?.settings?.[0]
  const { data: rawRates } = useQuery(ratesQueryOptions(settings?.ratesUrl))
  const ratesData = normalizeRatesPayload(rawRates) ?? rawRates ?? null

  const exportCsv = () => {
    if (!snapshot) return
    exportVpsCsv(
      snapshot.vps.map((v) => ({
        ip: v.ip,
        project: v.project ?? '',
        status: v.status,
        vcpu: v.vcpu,
        ramGb: v.ramGb,
        diskGb: v.diskGb,
        monthlyRate: v.monthlyRate ?? 0,
        currency: v.currency,
      })),
      'vps-report.csv',
    )
  }

  return (
    <AnalyticsPage
      title="Отчёты"
      description="Расходы, платежи и динамика"
      actions={
        <Button variant="outline" onClick={exportCsv} disabled={!snapshot}>
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
        const providerById = providerByIdMap(snap.providers)
        const baseCurrency = (snap.settings[0]?.baseCurrency ?? 'RUB').toUpperCase()
        const monthly = snap.vps.reduce(
          (acc, v) =>
            acc + convertVpsMonthlyBurnToBase(v, providerById.get(v.providerId), snap.settings, ratesData),
          0,
        )
        return (
          <>
            <SectionCards
              items={[
                {
                  label: 'Расход/мес',
                  value: formatCurrency(monthly, baseCurrency),
                  icon: <TrendingUpIcon className="size-4" />,
                  hint: `в ${baseCurrency}`,
                },
                {
                  label: 'Платежей',
                  value: snap.payments.length,
                  icon: <CreditCardIcon className="size-4" />,
                },
                {
                  label: 'Активных VPS',
                  value: snap.vps.filter((v) => v.status === 'active').length,
                  icon: <ServerIcon className="size-4" />,
                  hint: `из ${snap.vps.length}`,
                },
              ]}
            />
            <ChartsGrid>
              <MonthlyExpenseChart
                vps={snap.vps}
                providers={snap.providers}
                providerAccounts={snap.providerAccounts}
                settings={snap.settings}
                ratesData={ratesData}
              />
              <PaymentsPieChart payments={snap.payments} settings={snap.settings} ratesData={ratesData} />
              <MonthlyTrendChart
                payments={snap.payments}
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
