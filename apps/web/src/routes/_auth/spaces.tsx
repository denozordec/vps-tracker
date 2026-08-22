import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@cfdm/ui/components/button'
import { Label } from '@cfdm/ui/components/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@cfdm/ui/components/select'

import { AutoCompleteInput } from '@/components/auto-complete-input'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { PageHeader } from '@/components/page-header'
import { PageShell } from '@/components/page-shell'
import { SettingsCard } from '@/components/reui-kit/settings-card'
import { ResourcePage, columnDefFromDataGrid } from '@/components/reui-kit'
import type { DataGridColumn } from '@/components/data-grid-types'
import { api } from '@/lib/api-client'
import { useSpaceId } from '@/lib/space'
import {
  deletedSpacesQueryOptions,
  spacesKeys,
  spacesQueryOptions,
  snapshotKeys,
} from '@/queries/snapshot'

export const Route = createFileRoute('/_auth/spaces')({
  component: SpacesPage,
})

type MemberRow = {
  spaceId: string
  userId: string
  role: string
  createdAt: string
}

type PortalUser = { id: string; email: string; name: string }

function SpacesPage() {
  const qc = useQueryClient()
  const { spaceId } = useSpaceId()
  const { data: spaces = [] } = useQuery(spacesQueryOptions())
  const { data: trash = [] } = useQuery(deletedSpacesQueryOptions())
  const current = spaces.find((s) => s.id === spaceId) ?? spaces[0]
  const currentId = current?.id ?? ''
  const myRole = current?.role ?? 'viewer'
  const canAdmin = myRole === 'owner' || myRole === 'admin'

  const membersQuery = useQuery({
    queryKey: spacesKeys.members(currentId),
    queryFn: () => api.fetchSpaceMembers(currentId),
    enabled: Boolean(currentId),
  })

  const [userQuery, setUserQuery] = useState('')
  const [selectedUserId, setSelectedUserId] = useState('')
  const [role, setRole] = useState('member')
  const [portalUsers, setPortalUsers] = useState<PortalUser[]>([])
  const [memberLabels, setMemberLabels] = useState<Record<string, string>>({})
  const [transferUserId, setTransferUserId] = useState('')
  const [transferQuery, setTransferQuery] = useState('')

  useEffect(() => {
    const q = userQuery.trim() || transferQuery.trim()
    const t = setTimeout(() => {
      void api
        .searchPortalUsers(q)
        .then(setPortalUsers)
        .catch(() => setPortalUsers([]))
    }, q ? 250 : 0)
    return () => clearTimeout(t)
  }, [userQuery, transferQuery])

  // Resolve names for current members (search by userId)
  useEffect(() => {
    const members = membersQuery.data
    if (!members?.length) return
    let cancelled = false
    void (async () => {
      const next: Record<string, string> = {}
      await Promise.all(
        members.map(async (m) => {
          try {
            const found = await api.searchPortalUsers(m.userId)
            const u = found.find((x) => x.id === m.userId) ?? found[0]
            if (u && u.id === m.userId) {
              next[m.userId] = `${u.name} · ${u.email}`
            }
          } catch {
            /* ignore */
          }
        }),
      )
      if (!cancelled) setMemberLabels((prev) => ({ ...prev, ...next }))
    })()
    return () => {
      cancelled = true
    }
  }, [membersQuery.data])

  const userOptions = useMemo(
    () =>
      portalUsers.map((u) => ({
        value: u.id,
        label: `${u.name} · ${u.email}`,
      })),
    [portalUsers],
  )

  const userLabelById = useMemo(() => {
    const map = new Map<string, string>(Object.entries(memberLabels))
    for (const u of portalUsers) {
      map.set(u.id, `${u.name} · ${u.email}`)
    }
    return map
  }, [portalUsers, memberLabels])

  const addMutation = useMutation({
    mutationFn: () =>
      api.addSpaceMember(currentId, { userId: selectedUserId.trim(), role }),
    onSuccess: async () => {
      setSelectedUserId('')
      setUserQuery('')
      toast.success('Участник добавлен')
      await qc.invalidateQueries({ queryKey: spacesKeys.members(currentId) })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const removeMutation = useMutation({
    mutationFn: (uid: string) => api.removeSpaceMember(currentId, uid),
    onSuccess: async () => {
      toast.success('Доступ отозван')
      await qc.invalidateQueries({ queryKey: spacesKeys.members(currentId) })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const transferMutation = useMutation({
    mutationFn: () => api.transferSpaceOwnership(currentId, transferUserId.trim()),
    onSuccess: async () => {
      setTransferUserId('')
      setTransferQuery('')
      toast.success('Владение передано')
      await qc.invalidateQueries({ queryKey: spacesKeys.all })
      await qc.invalidateQueries({ queryKey: spacesKeys.members(currentId) })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const restoreMutation = useMutation({
    mutationFn: (id: string) => api.restoreSpace(id),
    onSuccess: async () => {
      toast.success('Пространство восстановлено')
      await qc.invalidateQueries({ queryKey: spacesKeys.all })
      await qc.invalidateQueries({ queryKey: spacesKeys.deleted })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const purgeMutation = useMutation({
    mutationFn: (id: string) => api.purgeSpace(id),
    onSuccess: async () => {
      toast.success('Пространство удалено навсегда')
      await qc.invalidateQueries({ queryKey: spacesKeys.deleted })
      await qc.invalidateQueries({ queryKey: snapshotKeys.all })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const memberColumns: DataGridColumn<MemberRow>[] = useMemo(
    () => [
      {
        key: 'user',
        header: 'Пользователь',
        cell: (m) => (
          <div className="flex flex-col gap-0.5">
            <span className="text-sm">{userLabelById.get(m.userId) ?? m.userId}</span>
            {!userLabelById.has(m.userId) ? (
              <span className="text-muted-foreground font-mono text-xs">{m.userId}</span>
            ) : null}
          </div>
        ),
      },
      { key: 'role', header: 'Роль', cell: (m) => m.role },
      {
        key: 'actions',
        header: '',
        className: 'w-36',
        cell: (m) =>
          canAdmin && m.role !== 'owner' ? (
            <ConfirmDialog
              title="Отозвать доступ?"
              description="Пользователь потеряет доступ к этому пространству."
              confirmLabel="Отозвать"
              destructive
              onConfirm={() => removeMutation.mutate(m.userId)}
              trigger={
                <Button variant="outline" size="sm">
                  Отозвать
                </Button>
              }
            />
          ) : null,
      },
    ],
    [canAdmin, removeMutation, userLabelById],
  )

  const trashColumns: DataGridColumn<(typeof trash)[number]>[] = useMemo(
    () => [
      { key: 'name', header: 'Название', cell: (s) => s.name },
      {
        key: 'deletedAt',
        header: 'Удалено',
        cell: (s) => (
          <span className="text-muted-foreground text-sm">
            {s.deletedAt ? new Date(s.deletedAt).toLocaleString('ru-RU') : '—'}
          </span>
        ),
      },
      {
        key: 'actions',
        header: '',
        className: 'w-64',
        cell: (s) => (
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => restoreMutation.mutate(s.id)}
              disabled={restoreMutation.isPending}
            >
              Восстановить
            </Button>
            <ConfirmDialog
              title="Удалить навсегда?"
              description="Безвозвратно: все данные пространства будут уничтожены."
              confirmLabel="Удалить навсегда"
              destructive
              onConfirm={() => purgeMutation.mutate(s.id)}
              trigger={
                <Button size="sm" variant="destructive">
                  Удалить навсегда
                </Button>
              }
            />
          </div>
        ),
      },
    ],
    [purgeMutation, restoreMutation],
  )

  const addMemberForm = canAdmin ? (
    <div className="flex w-full flex-col gap-3 md:flex-row md:items-end">
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <Label>Пользователь</Label>
        <AutoCompleteInput
          value={
            selectedUserId
              ? (userLabelById.get(selectedUserId) ?? userQuery)
              : userQuery
          }
          onChange={(v) => {
            const match = userOptions.find(
              (o) => o.value === v || o.label === v,
            )
            if (match) {
              setSelectedUserId(match.value)
              setUserQuery(match.label)
            } else {
              setSelectedUserId('')
              setUserQuery(v)
            }
          }}
          options={userOptions}
          placeholder="Имя или email…"
          allowFreeText={false}
          emptyText="Пользователи не найдены"
        />
      </div>
      <div className="flex w-full flex-col gap-2 md:w-40">
        <Label>Роль</Label>
        <Select value={role} onValueChange={(v) => setRole(v ?? 'member')}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="admin">admin</SelectItem>
            <SelectItem value="member">member</SelectItem>
            <SelectItem value="viewer">viewer</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Button
        disabled={!selectedUserId.trim() || addMutation.isPending}
        onClick={() => addMutation.mutate()}
      >
        Добавить
      </Button>
    </div>
  ) : null

  return (
    <PageShell>
      <PageHeader
        title="Пространство"
        description={
          current
            ? `${current.name} (${current.kind === 'main' ? 'основное' : 'личное'})`
            : 'Участники и доступ'
        }
      />

      <div className="flex flex-col gap-4">
        {myRole === 'owner' ? (
          <SettingsCard
            title="Владелец"
            description="Передать владение другому пользователю из auth-portal"
            footer={
              <ConfirmDialog
                title="Передать владение?"
                description="Вы станете admin. Новый владелец получит полный контроль."
                confirmLabel="Передать"
                onConfirm={() => transferMutation.mutate()}
                trigger={
                  <Button
                    type="button"
                    disabled={!transferUserId.trim() || transferMutation.isPending}
                  >
                    Передать владение
                  </Button>
                }
              />
            }
          >
            <div className="flex flex-col gap-2 px-5 py-4">
              <Label>Новый владелец</Label>
              <AutoCompleteInput
                value={
                  transferUserId
                    ? (userLabelById.get(transferUserId) ?? transferQuery)
                    : transferQuery
                }
                onChange={(v) => {
                  const match = userOptions.find(
                    (o) => o.value === v || o.label === v,
                  )
                  if (match) {
                    setTransferUserId(match.value)
                    setTransferQuery(match.label)
                  } else {
                    setTransferUserId('')
                    setTransferQuery(v)
                  }
                }}
                options={userOptions}
                placeholder="Имя или email…"
                allowFreeText={false}
                emptyText="Пользователи не найдены"
              />
            </div>
          </SettingsCard>
        ) : null}

        <ResourcePage
          title="Участники"
          description="Доступ к текущему пространству"
          columns={columnDefFromDataGrid(memberColumns)}
          data={membersQuery.data ?? []}
          getRowId={(m) => `${m.spaceId}-${m.userId}`}
          pagination={false}
          isLoading={membersQuery.isLoading}
          isError={membersQuery.isError}
          error={membersQuery.error as Error | null}
          onRetry={() => void membersQuery.refetch()}
          toolbarExtra={addMemberForm}
          emptyTitle="Нет участников"
          emptyDescription="Добавьте пользователя по имени или email"
        />

        <ResourcePage
          title="Корзина"
          description="Удалённые пространства можно восстановить или удалить навсегда"
          columns={columnDefFromDataGrid(trashColumns)}
          data={trash}
          getRowId={(s) => s.id}
          pagination={false}
          emptyTitle="Корзина пуста"
          emptyDescription="Удалённых пространств нет"
        />
      </div>
    </PageShell>
  )
}
