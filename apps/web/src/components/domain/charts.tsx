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
  type ChartConfig,
} from '@cfdm/ui/components/chart'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@cfdm/ui/components/card'
import type { ReactNode } from 'react'

import type { Vps, Provider, Payment, Settings, RatesData } from '@/types/entities'
import { convertCurrency, formatCurrency, monthKey, toIsoCurrency } from '@/lib/format'
import { providerByIdMap } from '@/lib/billmanager'

const EXPENSE_CONFIG: ChartConfig = {
  expense: { label: 'Расход', color: 'var(--chart-1)' },
}

export function MonthlyExpenseChart({
  vps,
  providers,
  settings,
  ratesData,
  className,
}: {
  vps: Vps[]
  providers: Provider[]
  settings: Settings[]
  ratesData: RatesData | null
  className?: string
}) {
  const baseCurrency = (settings[0]?.baseCurrency ?? 'RUB').toUpperCase()
  const providerById = providerByIdMap(providers)

  const monthlyByAccount = new Map<string, number>()
  for (const v of vps) {
    if (v.status !== 'active') continue
    const provider = providerById.get(v.providerId)
    const monthly = Number(v.monthlyRate || 0)
    const daily = Number(v.dailyRate || 0)
    const burn = v.tariffType === 'daily' ? daily * 30 : monthly
    const fromCurrency = toIsoCurrency(provider?.baseCurrency || v.currency || baseCurrency)
    const converted = convertCurrency(burn, fromCurrency, baseCurrency, ratesData)
    monthlyByAccount.set(v.providerAccountId, (monthlyByAccount.get(v.providerAccountId) ?? 0) + converted)
  }

  const data = Array.from(monthlyByAccount.entries())
    .map(([accountId, value]) => ({
      accountId,
      name: providerById.get(accountId)?.name ?? accountId,
      expense: Math.round(value),
    }))
    .sort((a, b) => b.expense - a.expense)
    .slice(0, 10)

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Расходы по хостерам (мес)</CardTitle>
        <CardDescription>Топ-10 по monthly rate, в {baseCurrency}</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={EXPENSE_CONFIG} className="h-72 w-full">
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis dataKey="name" tickLine={false} axisLine={false} tickMargin={8} />
            <YAxis tickLine={false} axisLine={false} width={48} />
            <RechartsTooltip cursor={false} content={<ChartTooltipContent formatter={(v) => formatCurrency(Number(v), baseCurrency)} />} />
            <Bar dataKey="expense" fill="var(--color-expense)" radius={4} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}

const PIE_COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)']

const PAYMENTS_CONFIG: ChartConfig = {
  amount: { label: 'Платежи', color: 'var(--chart-2)' },
}

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
  const byType = new Map<string, number>()
  for (const p of payments) {
    const converted = convertCurrency(Number(p.amount), toIsoCurrency(p.currency), baseCurrency, ratesData)
    byType.set(p.type, (byType.get(p.type) ?? 0) + converted)
  }
  const data = Array.from(byType.entries()).map(([type, amount]) => ({ type, amount: Math.round(amount) }))

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Платежи по типам</CardTitle>
        <CardDescription>Структура в {baseCurrency}</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={PAYMENTS_CONFIG} className="mx-auto h-72 w-full">
          <PieChart>
            <RechartsTooltip content={<ChartTooltipContent nameKey="type" formatter={(v) => formatCurrency(Number(v), baseCurrency)} />} />
            <Pie data={data} dataKey="amount" nameKey="type" innerRadius={50} outerRadius={90} strokeWidth={2}>
              {data.map((_, i) => (
                <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
              ))}
            </Pie>
          </PieChart>
        </ChartContainer>
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
        <ChartContainer config={trendConfig} className="h-72 w-full">
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} />
            <YAxis tickLine={false} axisLine={false} width={48} />
            <RechartsTooltip cursor={false} content={<ChartTooltipContent formatter={(v) => formatCurrency(Number(v), baseCurrency)} />} />
            <Bar dataKey="amount" fill="var(--color-amount)" radius={4} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}

export function ChartsGrid({ children }: { children: ReactNode }) {
  return <div className="grid gap-4 lg:grid-cols-2">{children}</div>
}
