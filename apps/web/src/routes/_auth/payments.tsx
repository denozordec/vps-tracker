import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { PlusIcon, PencilIcon, Trash2Icon } from 'lucide-react'
import { toast } from 'sonner'

import { snapshotQueryOptions } from '@/queries/snapshot'
import { api, ApiError } from '@/lib/api-client'
import { PageShell } from '@/components/page-shell'
import { PageHeader } from '@/components/page-header'
import { Button } from '@cfdm/ui/components/button'
import { DataTableCard, type DataTableColumn } from '@/components/data-table-card'
import { QueryState } from '@/components/query-state'
import { TableSkeleton } from '@/components/skeletons'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { FormSheet } from '@/components/form-sheet'
import { FormField } from '@/components/form-field'
import { Input } from '@cfdm/ui/components/input'
import { Textarea } from '@cfdm/ui/components/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@cfdm/ui/components/select'

import type { Payment, PaymentType } from '@/types/entities'
import { paymentTypeLabel, formatCurrency } from '@/lib/format'
import { providerByIdMap, accountSelectLabel } from '@/lib/billmanager'

export const Route = createFileRoute('/_auth/payments')({
  loader: ({ context: { queryClient } }) =>
    queryClient.ensureQueryData(snapshotQueryOptions()),
  component: PaymentsPage,
})

interface FormState {
  id?: string
  type: PaymentType
  date: string
  amount: number
  currency: string
  providerAccountId: string
  note: string
}

const TODAY = new Date().toISOString().slice(0, 10)
const EMPTY: FormState = { type: 'provider_balance_topup', date: TODAY, amount: 0, currency: 'RUB', providerAccountId: '', note: '' }

function PaymentsPage() {
  const queryClient = useQueryClient()
  const { data: snapshot, isLoading, isError, error, refetch } = useQuery(snapshotQueryOptions())
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY)

  const saveMut = useMutation({
    mutationFn: (r: FormState) => r.id
      ? api.update<Payment>('payments', r.id, r as unknown as Partial<Payment>)
      : api.create('payments', r as unknown as Payment),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['snapshot'] })
      toast.success('Платёж сохранён')
      setOpen(false)
    },
    onError: (e: unknown) => toast.error(e instanceof ApiError ? e.message : 'Ошибка'),
  })
  const delMut = useMutation({
    mutationFn: (id: string) => api.remove<Payment>('payments', id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['snapshot'] })
      toast.success('Платёж удалён')
    },
    onError: (e: unknown) => toast.error(e instanceof ApiError ? e.message : 'Ошибка'),
  })

  const openCreate = () => { setForm({ ...EMPTY, providerAccountId: snapshot?.providerAccounts[0]?.id ?? '' }); setOpen(true) }
  const openEdit = (p: Payment) => {
    setForm({
      id: p.id, type: p.type, date: p.date, amount: p.amount, currency: p.currency,
      providerAccountId: p.providerAccountId, note: p.note ?? '',
    })
    setOpen(true)
  }

  const providerById = snapshot ? providerByIdMap(snapshot.providers) : new Map()

  const columns: DataTableColumn<Payment>[] = [
    { key: 'date', header: 'Дата', cell: (p) => <span className="tabular-nums">{p.date}</span> },
    {
      key: 'account',
      header: 'Аккаунт',
      cell: (p) => {
        const acc = snapshot?.providerAccounts.find((a) => a.id === p.providerAccountId)
        return acc ? accountSelectLabel(acc, providerById) : '—'
      },
    },
    {
      key: 'type',
      header: 'Тип',
      cell: (p) => <span>{paymentTypeLabel(p.type)}</span>,
    },
    {
      key: 'amount',
      header: 'Сумма',
      cell: (p) => <span className="tabular-nums">{formatCurrency(p.amount, p.currency)}</span>,
    },
    { key: 'note', header: 'Заметка', cell: (p) => <span className="text-muted-foreground">{p.note || '—'}</span> },
    {
      key: 'actions',
      header: '',
      className: 'w-24 text-right',
      cell: (p) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="icon-sm" onClick={() => openEdit(p)} aria-label="Редактировать">
            <PencilIcon />
          </Button>
          <ConfirmDialog
            trigger={<Button variant="ghost" size="icon-sm" aria-label="Удалить"><Trash2Icon /></Button>}
            title="Удалить платёж?"
            confirmLabel="Удалить"
            destructive
            onConfirm={() => delMut.mutate(p.id)}
          />
        </div>
      ),
    },
  ]

  const sorted = [...(snapshot?.payments ?? [])].sort((a, b) => b.date.localeCompare(a.date))

  return (
    <PageShell>
      <PageHeader
        title="Платежи"
        description="Пополнения балансов и прямые платежи за VPS"
        actions={<Button onClick={openCreate}><PlusIcon data-icon="inline-start" />Добавить</Button>}
      />
      <QueryState
        data={snapshot}
        isLoading={isLoading}
        isError={isError}
        error={error}
        onRetry={() => refetch()}
        skeleton={<TableSkeleton />}
        empty={snapshot?.payments.length === 0}
        emptyTitle="Платежей нет"
        emptyAction={<Button onClick={openCreate}><PlusIcon data-icon="inline-start" />Добавить платёж</Button>}
      >
        {() => <DataTableCard columns={columns} data={sorted} rowKey={(p) => p.id} />}
      </QueryState>

      <FormSheet
        open={open}
        onOpenChange={setOpen}
        trigger={null}
        title={form.id ? 'Редактировать платёж' : 'Новый платёж'}
        onSubmit={() => saveMut.mutate(form)}
        submitting={saveMut.isPending}
      >
        <FormField label="Тип" htmlFor="pay-type">
          <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: (v ?? 'provider_balance_topup') as PaymentType })}>
            <SelectTrigger id="pay-type"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="provider_balance_topup">{paymentTypeLabel('provider_balance_topup')}</SelectItem>
              <SelectItem value="direct_vps_payment">{paymentTypeLabel('direct_vps_payment')}</SelectItem>
              <SelectItem value="daily_debit">{paymentTypeLabel('daily_debit')}</SelectItem>
              <SelectItem value="monthly_debit">{paymentTypeLabel('monthly_debit')}</SelectItem>
            </SelectContent>
          </Select>
        </FormField>
        <FormField label="Аккаунт" htmlFor="pay-acc">
          <Select value={form.providerAccountId} onValueChange={(v) => setForm({ ...form, providerAccountId: v ?? '' })}>
            <SelectTrigger id="pay-acc"><SelectValue placeholder="Выберите аккаунт" /></SelectTrigger>
            <SelectContent>
              {snapshot?.providerAccounts.map((a) => (
                <SelectItem key={a.id} value={a.id}>{accountSelectLabel(a, providerById)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
        <div className="grid grid-cols-3 gap-3">
          <FormField label="Дата" htmlFor="pay-date">
            <Input id="pay-date" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </FormField>
          <FormField label="Сумма" htmlFor="pay-amount">
            <Input id="pay-amount" type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} />
          </FormField>
          <FormField label="Валюта" htmlFor="pay-cur">
            <Input id="pay-cur" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} />
          </FormField>
        </div>
        <FormField label="Заметка" htmlFor="pay-note">
          <Textarea id="pay-note" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
        </FormField>
      </FormSheet>
    </PageShell>
  )
}
