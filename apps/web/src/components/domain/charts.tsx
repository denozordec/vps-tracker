import {
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Cell,
  Pie,
  PieChart,
  Tooltip as RechartsTooltip,
} from 'recharts'
import {
  ChartContainer,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from '@cfdm/ui/components/chart'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@cfdm/ui/components/card'
import type { ReactNode } from 'react'
import { useMemo, useState } from 'react'

import { SelectField } from '@/components/select-field'
import {
  aggregatePaymentsByMonthYear,
  aggregateDashboardExpensesByMonthYear,
  availablePaymentYears,
  availableExpenseYears,
  type PaymentChartFilter,
} from '@/lib/chart-analytics'

import type { Vps, Provider, Payment, Settings, RatesData, ServerProject, BalanceLedgerRow } from '@/types/entities'
import {
  canonicalPaymentType,
  convertCurrency,
  convertVpsMonthlyBurnToBase,
  formatCurrency,
  monthKey,
  paymentTypeLabel,
  toIsoCurrency,
} from '@/lib/format'
import { providerByIdMap } from '@/lib/billmanager'
import { aggregateBurnByProject } from '@/lib/project-analytics'
import { EmptyState } from '@/components/empty-state'

function ChartEmpty({ message }: { message: string }) {
  return <EmptyState title={message} className="h-72 border-none" />
}

const EXPENSE_CONFIG: ChartConfig = {
  expense: { label: 'Расход', color: 'var(--chart-1)' },
}

export function MonthlyExpenseChart({
  vps,
  providers,
  providerAccounts,
  settings,
  ratesData,
  className,
  title = 'Расходы по хостерам (мес)',
  description,
}: {
  vps: Vps[]
  providers: Provider[]
  providerAccounts?: { id: string; name: string; providerId: string }[]
  settings: Settings[]
  ratesData: RatesData | null
  className?: string
  title?: string
  description?: string
}) {
  const baseCurrency = (settings[0]?.baseCurrency ?? 'RUB').toUpperCase()
  const providerById = providerByIdMap(providers)
  const accountById = new Map((providerAccounts ?? []).map((a) => [a.id, a]))

  const monthlyByAccount = new Map<string, number>()
  for (const v of vps) {
    const provider = providerById.get(v.providerId)
    const converted = convertVpsMonthlyBurnToBase(v, provider, settings, ratesData)
    monthlyByAccount.set(v.providerAccountId, (monthlyByAccount.get(v.providerAccountId) ?? 0) + converted)
  }

  const data = Array.from(monthlyByAccount.entries())
    .map(([accountId, value]) => ({
      accountId,
      name: accountById.get(accountId)?.name ?? accountId,
      expense: Math.round(value),
    }))
    .sort((a, b) => b.expense - a.expense)
    .slice(0, 10)

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description ?? `Топ-10 по monthly rate, в ${baseCurrency}`}</CardDescription>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <ChartEmpty message="Нет данных для графика" />
        ) : (
        <ChartContainer config={EXPENSE_CONFIG} className="h-72 w-full" aria-label="График расходов по VPS">
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis dataKey="name" tickLine={false} axisLine={false} tickMargin={8} />
            <YAxis tickLine={false} axisLine={false} width={48} />
            <RechartsTooltip cursor={false} content={<ChartTooltipContent formatter={(v) => formatCurrency(Number(v), baseCurrency)} />} />
            <Bar dataKey="expense" fill="var(--color-expense)" radius={4} />
          </BarChart>
        </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}

const PIE_COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)']

export function PaymentsPieChart({
  payments,
  settings,
  ratesData,
  className,
}: {
  payments: Payment[]
  settings: Settings[]
  ratesData: RatesData | null
  className?: string
}) {
  const baseCurrency = (settings[0]?.baseCurrency ?? 'RUB').toUpperCase()

  const { data, chartConfig } = useMemo(() => {
    const byType = new Map<string, number>()
    for (const p of payments) {
      const type = canonicalPaymentType(p.type)
      const converted = convertCurrency(Number(p.amount), toIsoCurrency(p.currency), baseCurrency, ratesData)
      byType.set(type, (byType.get(type) ?? 0) + converted)
    }
    const entries = Array.from(byType.entries())
      .map(([type, amount]) => ({ type, amount: Math.round(amount) }))
      .filter((row) => row.amount > 0)
      .sort((a, b) => b.amount - a.amount)

    const config: ChartConfig = {
      amount: { label: 'Платежи', color: 'var(--chart-2)' },
    }
    entries.forEach((row, i) => {
      config[row.type] = {
        label: paymentTypeLabel(row.type),
        color: PIE_COLORS[i % PIE_COLORS.length],
      }
    })
    return { data: entries, chartConfig: config }
  }, [payments, baseCurrency, ratesData])

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Платежи по типам</CardTitle>
        <CardDescription>Структура в {baseCurrency}</CardDescription>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <ChartEmpty message="Нет данных о платежах" />
        ) : (
        <ChartContainer config={chartConfig} className="mx-auto h-72 w-full" aria-label="График платежей по типам">
          <PieChart>
            <RechartsTooltip
              content={
                <ChartTooltipContent
                  nameKey="type"
                  formatter={(v) => formatCurrency(Number(v), baseCurrency)}
                />
              }
            />
            <ChartLegend content={<ChartLegendContent nameKey="type" />} />
            <Pie data={data} dataKey="amount" nameKey="type" innerRadius={50} outerRadius={90} strokeWidth={2}>
              {data.map((row, i) => (
                <Cell key={row.type} fill={PIE_COLORS[i % PIE_COLORS.length]} />
              ))}
            </Pie>
          </PieChart>
        </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}

function DashboardMonthlyBarChart({
  payments,
  settings,
  ratesData,
  title,
  description = 'Последние 12 мес',
  chartColor,
  paymentFilter,
  className,
  ariaLabel,
}: {
  payments: Payment[]
  settings: Settings[]
  ratesData: RatesData | null
  title: string
  description?: string
  chartColor: string
  paymentFilter: PaymentChartFilter
  className?: string
  ariaLabel: string
}) {
  const baseCurrency = (settings[0]?.baseCurrency ?? 'RUB').toUpperCase()
  const years = useMemo(() => availablePaymentYears(payments), [payments])
  const currentYear = new Date().getFullYear()
  const [year, setYear] = useState(currentYear)

  const effectiveYear = years.includes(year) ? year : currentYear

  const data = useMemo(
    () => aggregatePaymentsByMonthYear(payments, effectiveYear, settings, ratesData, paymentFilter),
    [payments, effectiveYear, settings, ratesData, paymentFilter],
  )

  const chartConfig: ChartConfig = useMemo(
    () => ({
      amount: { label: title, color: chartColor },
    }),
    [title, chartColor],
  )

  const hasData = data.some((row) => row.amount > 0)

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
        <CardAction>
          <div className="flex flex-wrap items-center gap-2">
            <SelectField
              size="sm"
              triggerClassName="w-[130px]"
              aria-label="Группировка"
              value="month"
              options={[{ value: 'month', label: 'По месяцам' }]}
            />
            <SelectField
              size="sm"
              triggerClassName="w-[100px]"
              aria-label="Год"
              value={String(effectiveYear)}
              onValueChange={(v) => {
                if (v) setYear(Number(v))
              }}
              options={years.map((y) => ({ value: String(y), label: String(y) }))}
            />
          </div>
        </CardAction>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <ChartEmpty message="Нет данных за выбранный период" />
        ) : (
          <ChartContainer config={chartConfig} className="h-72 w-full" aria-label={ariaLabel}>
            <BarChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} />
              <YAxis tickLine={false} axisLine={false} width={48} />
              <RechartsTooltip
                cursor={false}
                content={
                  <ChartTooltipContent formatter={(v) => formatCurrency(Number(v), baseCurrency)} />
                }
              />
              <Bar dataKey="amount" fill="var(--color-amount)" radius={4} />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}

export function DashboardPaymentsChart(props: {
  payments: Payment[]
  settings: Settings[]
  ratesData: RatesData | null
  className?: string
}) {
  return (
    <DashboardMonthlyBarChart
      {...props}
      title="Платежи"
      chartColor="var(--chart-3)"
      paymentFilter="all"
      ariaLabel="График платежей по месяцам"
    />
  )
}

export function DashboardExpensesChart({
  payments,
  balanceLedger,
  vps,
  providers,
  settings,
  ratesData,
  className,
}: {
  payments: Payment[]
  balanceLedger: BalanceLedgerRow[]
  vps: Vps[]
  providers: Provider[]
  settings: Settings[]
  ratesData: RatesData | null
  className?: string
}) {
  const baseCurrency = (settings[0]?.baseCurrency ?? 'RUB').toUpperCase()
  const years = useMemo(
    () => availableExpenseYears(payments, balanceLedger),
    [payments, balanceLedger],
  )
  const currentYear = new Date().getFullYear()
  const [year, setYear] = useState(currentYear)

  const effectiveYear = years.includes(year) ? year : currentYear

  const { rows: data, mode } = useMemo(
    () =>
      aggregateDashboardExpensesByMonthYear(
        payments,
        balanceLedger,
        vps,
        providers,
        effectiveYear,
        settings,
        ratesData,
      ),
    [payments, balanceLedger, vps, providers, effectiveYear, settings, ratesData],
  )

  const chartConfig: ChartConfig = useMemo(
    () => ({
      amount: { label: 'Расходы', color: 'var(--chart-1)' },
    }),
    [],
  )

  const hasData = data.some((row) => row.amount > 0)
  const description =
    mode === 'estimate' ? 'Оценка по активным VPS за текущий год' : 'Последние 12 мес'

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Расходы</CardTitle>
        <CardDescription>{description}</CardDescription>
        <CardAction>
          <div className="flex flex-wrap items-center gap-2">
            <SelectField
              size="sm"
              triggerClassName="w-[130px]"
              aria-label="Группировка"
              value="month"
              options={[{ value: 'month', label: 'По месяцам' }]}
            />
            <SelectField
              size="sm"
              triggerClassName="w-[100px]"
              aria-label="Год"
              value={String(effectiveYear)}
              onValueChange={(v) => {
                if (v) setYear(Number(v))
              }}
              options={years.map((y) => ({ value: String(y), label: String(y) }))}
            />
          </div>
        </CardAction>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <ChartEmpty message="Нет данных за выбранный период" />
        ) : (
          <ChartContainer config={chartConfig} className="h-72 w-full" aria-label="График расходов по месяцам">
            <BarChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} />
              <YAxis tickLine={false} axisLine={false} width={48} />
              <RechartsTooltip
                cursor={false}
                content={
                  <ChartTooltipContent formatter={(v) => formatCurrency(Number(v), baseCurrency)} />
                }
              />
              <Bar dataKey="amount" fill="var(--color-amount)" radius={4} />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}

export function MonthlyTrendChart({
  payments,
  settings,
  ratesData,
  className,
}: {
  payments: Payment[]
  settings: Settings[]
  ratesData: RatesData | null
  className?: string
}) {
  const baseCurrency = (settings[0]?.baseCurrency ?? 'RUB').toUpperCase()
  const byMonth = new Map<string, number>()
  for (const p of payments) {
    const key = monthKey(p.date)
    if (!key) continue
    const converted = convertCurrency(Number(p.amount), toIsoCurrency(p.currency), baseCurrency, ratesData)
    byMonth.set(key, (byMonth.get(key) ?? 0) + converted)
  }
  const data = Array.from(byMonth.entries())
    .map(([month, amount]) => ({ month, amount: Math.round(amount) }))
    .sort((a, b) => a.month.localeCompare(b.month))
    .slice(-12)

  const trendConfig: ChartConfig = { amount: { label: 'Платежи', color: 'var(--chart-3)' } }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Динамика платежей</CardTitle>
        <CardDescription>Последние 12 месяцев, {baseCurrency}</CardDescription>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <ChartEmpty message="Нет данных за выбранный период" />
        ) : (
        <ChartContainer config={trendConfig} className="h-72 w-full" aria-label="График тренда расходов">
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} />
            <YAxis tickLine={false} axisLine={false} width={48} />
            <RechartsTooltip cursor={false} content={<ChartTooltipContent formatter={(v) => formatCurrency(Number(v), baseCurrency)} />} />
            <Bar dataKey="amount" fill="var(--color-amount)" radius={4} />
          </BarChart>
        </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}

export function ChartsGrid({ children }: { children: ReactNode }) {
  return <div className="grid w-full gap-4">{children}</div>
}

export function ProjectExpenseChart({
  vps,
  projects,
  providers,
  settings,
  ratesData,
  className,
}: {
  vps: Vps[]
  projects: ServerProject[]
  providers: Provider[]
  settings: Settings[]
  ratesData: RatesData | null
  className?: string
}) {
  const baseCurrency = (settings[0]?.baseCurrency ?? 'RUB').toUpperCase()
  const data = useMemo(
    () =>
      aggregateBurnByProject(vps, projects, {
        providers,
        settings,
        ratesData,
      }),
    [vps, projects, providers, settings, ratesData],
  )

  const chartConfig: ChartConfig = useMemo(() => {
    const config: ChartConfig = { expense: { label: 'Расход', color: 'var(--chart-1)' } }
    data.forEach((row, i) => {
      config[row.key] = {
        label: row.name,
        color: row.color ?? `var(--chart-${(i % 5) + 1})`,
      }
    })
    return config
  }, [data])

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Расходы по проектам (мес)</CardTitle>
        <CardDescription>Активные VPS, в {baseCurrency}</CardDescription>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <ChartEmpty message="Нет данных для графика" />
        ) : (
          <ChartContainer config={chartConfig} className="h-72 w-full" aria-label="График расходов по проектам">
            <BarChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="name" tickLine={false} axisLine={false} tickMargin={8} />
              <YAxis tickLine={false} axisLine={false} width={48} />
              <RechartsTooltip
                cursor={false}
                content={
                  <ChartTooltipContent formatter={(v) => formatCurrency(Number(v), baseCurrency)} />
                }
              />
              <Bar dataKey="expense" radius={4}>
                {data.map((row) => (
                  <Cell
                    key={row.key}
                    fill={row.color ?? chartConfig[row.key]?.color ?? 'var(--chart-1)'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}
