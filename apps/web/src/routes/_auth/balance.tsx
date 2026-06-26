import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { PlusIcon, Trash2Icon, ArrowDownUpIcon, CalendarIcon, UserRoundIcon, ArrowLeftRightIcon, CoinsIcon, StickyNoteIcon } from 'lucide-react'
import { toast } from 'sonner'

import { snapshotQueryOptions } from '@/queries/snapshot'
import { api, ApiError } from '@/lib/api-client'
import { PageShell } from '@/components/page-shell'
import { PageHeader } from '@/components/page-header'
import { Button } from '@cfdm/ui/components/button'
import { Badge } from '@cfdm/ui/components/badge'
import { DataGridCard, columnDefFromDataTable } from '@/components/data-grid-card'
import type { DataTableColumn } from '@/components/data-table-card'
import { dataGridCellStack } from '@/components/data-grid-cells'
import { QueryState } from '@/components/query-state'
import { SectionCardsSkeleton } from '@/components/skeletons'
import { SectionCards } from '@/components/section-cards'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { FormSheet } from '@/components/form-sheet'
import { FormField } from '@/components/form-field'
import { Input } from '@cfdm/ui/components/input'
import { SelectField } from '@/components/select-field'
import { Textarea } from '@cfdm/ui/components/textarea'

import type { BalanceLedgerRow, LedgerDirection } from '@/types/entities'
import { formatCurrency } from '@/lib/format'
import { providerByIdMap, accountSelectLabel } from '@/lib/billmanager'

export const Route = createFileRoute('/_auth/balance')({
  loader: ({ context: { queryClient } }) =>
    queryClient.ensureQueryData(snapshotQueryOptions()),
  component: BalancePage,
})

interface FormState {
  providerAccountId: string
  direction: LedgerDirection
  amount: number
  currency: string
  date: string
  note: string
}

const TODAY = new Date().toISOString().slice(0, 10)
const EMPTY: FormState = { providerAccountId: '', direction: 'credit', amount: 0, currency: 'RUB', date: TODAY, note: '' }

function BalancePage() {
  const queryClient = useQueryClient()
  const { data: snapshot, isLoading, isError, error, refetch } = useQuery(snapshotQueryOptions())
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY)

  const addMut = useMutation({
    mutationFn: (r: FormState) => api.create('balanceLedger', r as unknown as BalanceLedgerRow),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['snapshot'] })
      toast.success('Запись добавлена')
      setOpen(false)
    },
    onError: (e: unknown) => toast.error(e instanceof ApiError ? e.message : 'Ошибка'),
  })
  const delMut = useMutation({
    mutationFn: (id: string) => api.remove<BalanceLedgerRow>('balanceLedger', id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['snapshot'] })
      toast.success('Запись удалена')
    },
    onError: (e: unknown) => toast.error(e instanceof ApiError ? e.message : 'Ошибка'),
  })

  const openCreate = () => { setForm({ ...EMPTY, providerAccountId: snapshot?.providerAccounts[0]?.id ?? '' }); setOpen(true) }

  const providerById = snapshot ? providerByIdMap(snapshot.providers) : new Map()

  const columns: DataTableColumn<BalanceLedgerRow>[] = [
    {
      key: 'date',
      header: 'Дата',
      icon: CalendarIcon,
      cell: (r) => <span className="tabular-nums">{r.date}</span>,
    },
    {
      key: 'account',
      header: 'Аккаунт',
      icon: UserRoundIcon,
      sortValue: (r) => {
        const acc = snapshot?.providerAccounts.find((a) => a.id === r.providerAccountId)
        return acc ? accountSelectLabel(acc, providerById) : ''
      },
      cell: (r) => {
        const acc = snapshot?.providerAccounts.find((a) => a.id === r.providerAccountId)
        if (!acc) return '—'
        const providerName = providerById.get(acc.providerId)?.name ?? '—'
        return dataGridCellStack(acc.name, providerName)
      },
    },
    {
      key: 'dir',
      header: 'Движение',
      icon: ArrowLeftRightIcon,
      cell: (r) => (
        <Badge variant={r.direction === 'credit' ? 'default' : 'destructive'}>
          <ArrowDownUpIcon data-icon="inline-start" />
          {r.direction === 'credit' ? 'Приход' : 'Списание'}
        </Badge>
      ),
    },
    {
      key: 'amount',
      header: 'Сумма',
      icon: CoinsIcon,
      headerClassName: 'text-right',
      className: 'text-right',
      sortValue: (r) => Number(r.amount),
      cell: (r) => (
        <span className={`tabular-nums font-medium ${r.direction === 'credit' ? '' : 'text-destructive'}`}>
          {r.direction === 'credit' ? '+' : '−'}{formatCurrency(Number(r.amount), r.currency ?? 'RUB')}
        </span>
      ),
    },
    {
      key: 'note',
      header: 'Заметка',
      icon: StickyNoteIcon,
      cell: (r) => <span className="text-muted-foreground">{r.note || '—'}</span>,
    },
    {
      key: 'actions',
      header: '',
      sortable: false,
      className: 'w-16 text-right',
      cell: (r) => (
        <ConfirmDialog
          trigger={<Button variant="ghost" size="icon-sm" aria-label="Удалить"><Trash2Icon /></Button>}
          title="Удалить запись?"
          confirmLabel="Удалить"
          destructive
          onConfirm={() => delMut.mutate(r.id)}
        />
      ),
    },
  ]

  const rows = [...(snapshot?.balanceLedger ?? [])].sort((a, b) => b.date.localeCompare(a.date))

  const totalCredit = rows.filter((r) => r.direction === 'credit').reduce((acc, r) => acc + Number(r.amount || 0), 0)
  const totalDebit = rows.filter((r) => r.direction === 'debit').reduce((acc, r) => acc + Number(r.amount || 0), 0)

  return (
    <PageShell>
      <PageHeader
        title="Баланс и списания"
        description="Журнал движений по аккаунтам"
        actions={<Button onClick={openCreate}><PlusIcon data-icon="inline-start" />Добавить запись</Button>}
      />
      <QueryState
        data={snapshot}
        isLoading={isLoading}
        isError={isError}
        error={error}
        onRetry={() => refetch()}
        skeleton={<SectionCardsSkeleton count={3} />}
      >
        {(snap) => (
          <>
            <SectionCards
              items={[
                { label: 'Всего приходов', value: formatCurrency(totalCredit, snap.settings[0]?.baseCurrency ?? 'RUB') },
                { label: 'Всего списаний', value: formatCurrency(totalDebit, snap.settings[0]?.baseCurrency ?? 'RUB') },
                { label: 'Чистый баланс (ledger)', value: formatCurrency(totalCredit - totalDebit, snap.settings[0]?.baseCurrency ?? 'RUB') },
              ]}
            />
            <DataGridCard
              columns={columnDefFromDataTable(columns)}
              data={rows}
              rowId={(r) => r.id}
              emptyTitle="Записей нет"
              emptyAction={<Button onClick={openCreate}><PlusIcon data-icon="inline-start" />Добавить</Button>}
              pinLastColumn
              footerContent={
                <div className="flex justify-end gap-6 px-3 py-2 text-sm tabular-nums">
                  <span>Приходы: <b className="text-foreground">{formatCurrency(totalCredit, snap.settings[0]?.baseCurrency ?? 'RUB')}</b></span>
                  <span>Списания: <b className="text-foreground">{formatCurrency(totalDebit, snap.settings[0]?.baseCurrency ?? 'RUB')}</b></span>
                  <span>Итого: <b className="text-foreground">{formatCurrency(totalCredit - totalDebit, snap.settings[0]?.baseCurrency ?? 'RUB')}</b></span>
                </div>
              }
            />
          </>
        )}
      </QueryState>

      <FormSheet
        open={open}
        onOpenChange={setOpen}
        trigger={null}
        title="Новая запись"
        onSubmit={() => addMut.mutate(form)}
        submitting={addMut.isPending}
      >
        <FormField label="Аккаунт" htmlFor="bl-acc">
          <SelectField
            triggerId="bl-acc"
            placeholder="Выберите аккаунт"
            value={form.providerAccountId}
            onValueChange={(v) => setForm({ ...form, providerAccountId: v ?? '' })}
            options={(snapshot?.providerAccounts ?? []).map((a) => ({
              value: a.id,
              label: accountSelectLabel(a, providerById),
            }))}
          />
        </FormField>
        <FormField label="Движение" htmlFor="bl-dir">
          <SelectField
            triggerId="bl-dir"
            value={form.direction}
            onValueChange={(v) => setForm({ ...form, direction: (v ?? 'credit') as LedgerDirection })}
            options={[
              { value: 'credit', label: 'Приход' },
              { value: 'debit', label: 'Списание' },
            ]}
          />
        </FormField>
        <div className="grid grid-cols-3 gap-3">
          <FormField label="Дата" htmlFor="bl-date">
            <Input id="bl-date" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </FormField>
          <FormField label="Сумма" htmlFor="bl-amount">
            <Input id="bl-amount" type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} />
          </FormField>
          <FormField label="Валюта" htmlFor="bl-cur">
            <Input id="bl-cur" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} />
          </FormField>
        </div>
        <FormField label="Заметка" htmlFor="bl-note">
          <Textarea id="bl-note" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
        </FormField>
      </FormSheet>
    </PageShell>
  )
}
