import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { CpuIcon, MemoryStickIcon, HardDriveIcon } from 'lucide-react'

import { snapshotQueryOptions } from '@/queries/snapshot'
import { AnalyticsPage } from '@/components/analytics-page'
import { SectionCards } from '@/components/section-cards'
import { Button } from '@cfdm/ui/components/button'
import {
  ChartContainer,
  ChartTooltipContent,
  type ChartConfig,
} from '@cfdm/ui/components/chart'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@cfdm/ui/components/card'
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { Tooltip as RechartsTooltip } from 'recharts'

export const Route = createFileRoute('/_auth/resources')({
  loader: ({ context: { queryClient } }) =>
    queryClient.ensureQueryData(snapshotQueryOptions()),
  component: ResourcesPage,
})

const RESOURCE_CONFIG: ChartConfig = {
  vcpu: { label: 'vCPU', color: 'var(--chart-1)' },
  ram: { label: 'RAM (GB)', color: 'var(--chart-2)' },
  disk: { label: 'Disk (GB)', color: 'var(--chart-3)' },
}

function ResourcesPage() {
  const { data: snapshot, isLoading, isError, error, refetch } = useQuery(snapshotQueryOptions())

  return (
    <AnalyticsPage
      title="Ресурсы"
      description="Сводка по вычислительным ресурсам активных VPS"
      data={snapshot}
      isLoading={isLoading}
      isError={isError}
      error={error}
      onRetry={() => refetch()}
      analyticsEmpty={snapshot?.vps.filter((v) => v.status === 'active').length === 0}
      emptyDescription="Нет активных VPS для построения сводки"
      emptyAction={
        <Button variant="outline" render={<Link to="/vps" />}>
          Перейти к VPS
        </Button>
      }
    >
      {(snap) => {
        const active = snap.vps.filter((v) => v.status === 'active')
        const totals = active.reduce(
          (acc, v) => ({
            vcpu: acc.vcpu + Number(v.vcpu || 0),
            ram: acc.ram + Number(v.ramGb || 0),
            disk: acc.disk + Number(v.diskGb || 0),
          }),
          { vcpu: 0, ram: 0, disk: 0 },
        )

        const byProvider = new Map<string, { name: string; vcpu: number; ram: number; disk: number }>()
        for (const v of active) {
          const provider = snap.providers.find((p) => p.id === v.providerId)
          const name = provider?.name ?? '—'
          const key = provider?.id ?? 'unknown'
          const entry = byProvider.get(key) ?? { name, vcpu: 0, ram: 0, disk: 0 }
          entry.vcpu += Number(v.vcpu || 0)
          entry.ram += Number(v.ramGb || 0)
          entry.disk += Number(v.diskGb || 0)
          byProvider.set(key, entry)
        }
        const chartData = Array.from(byProvider.values())

        return (
          <>
            <SectionCards
              items={[
                { label: 'vCPU', value: totals.vcpu, icon: <CpuIcon className="size-4" /> },
                { label: 'RAM (GB)', value: totals.ram, icon: <MemoryStickIcon className="size-4" /> },
                { label: 'Disk (GB)', value: totals.disk, icon: <HardDriveIcon className="size-4" /> },
              ]}
            />

            <Card>
              <CardHeader>
                <CardTitle>Ресурсы по хостерам</CardTitle>
                <CardDescription>Только активные VPS</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer config={RESOURCE_CONFIG} className="h-80 w-full">
                  <BarChart data={chartData} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" />
                    <XAxis dataKey="name" tickLine={false} axisLine={false} tickMargin={8} />
                    <YAxis tickLine={false} axisLine={false} width={48} />
                    <RechartsTooltip cursor={false} content={<ChartTooltipContent />} />
                    <Bar dataKey="vcpu" fill="var(--color-vcpu)" radius={4} />
                    <Bar dataKey="ram" fill="var(--color-ram)" radius={4} />
                    <Bar dataKey="disk" fill="var(--color-disk)" radius={4} />
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>
          </>
        )
      }}
    </AnalyticsPage>
  )
}
