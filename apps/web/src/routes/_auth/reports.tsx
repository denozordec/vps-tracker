import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { DownloadIcon } from 'lucide-react'

import { snapshotQueryOptions, ratesQueryOptions } from '@/queries/snapshot'
import { PageShell } from '@/components/page-shell'
import { PageHeader } from '@/components/page-header'
import { Button } from '@cfdm/ui/components/button'
import { QueryState } from '@/components/query-state'
import { SectionCardsSkeleton } from '@/components/skeletons'
import { SectionCards } from '@/components/section-cards'
import { ChartsGrid, MonthlyExpenseChart, PaymentsPieChart, MonthlyTrendChart } from '@/components/domain/charts'

import { normalizeRatesPayload, formatCurrency, toCsv, downloadTextFile } from '@/lib/format'

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
    const rows = snapshot.vps.map((v) => ({
      ip: v.ip, project: v.project ?? '', status: v.status, vcpu: v.vcpu, ramGb: v.ramGb, diskGb: v.diskGb,
      monthlyRate: v.monthlyRate ?? 0, currency: v.currency,
    }))
    downloadTextFile('vps-report.csv', toCsv(rows))
  }

  return (
    <PageShell>
      <PageHeader
        title="Отчёты"
        description="Расходы, платежи и динамика"
        actions={
          <Button variant="outline" onClick={exportCsv} disabled={!snapshot}>
            <DownloadIcon data-icon="inline-start" />
            Экспорт CSV
          </Button>
        }
      />
      <QueryState
        data={snapshot}
        isLoading={isLoading}
        isError={isError}
        error={error}
        onRetry={() => refetch()}
        skeleton={<SectionCardsSkeleton count={3} />}
      >
        {(snap) => {
          const monthly = snap.vps.filter((v) => v.status === 'active').reduce((acc, v) => {
            const burn = v.tariffType === 'daily' ? Number(v.dailyRate || 0) * 30 : Number(v.monthlyRate || 0)
            return acc + burn
          }, 0)
          return (
            <>
              <SectionCards
                items={[
                  { label: 'Расход/мес (в валюте VPS)', value: formatCurrency(monthly, snap.vps[0]?.currency ?? 'RUB') },
                  { label: 'Платежей всего', value: snap.payments.length },
                  { label: 'Активных VPS', value: snap.vps.filter((v) => v.status === 'active').length },
                ]}
              />
              <ChartsGrid>
                <MonthlyExpenseChart vps={snap.vps} providers={snap.providers} settings={snap.settings} ratesData={ratesData} />
                <PaymentsPieChart payments={snap.payments} settings={snap.settings} ratesData={ratesData} />
                <MonthlyTrendChart payments={snap.payments} settings={snap.settings} ratesData={ratesData} className="lg:col-span-2" />
              </ChartsGrid>
            </>
          )
        }}
      </QueryState>
    </PageShell>
  )
}
