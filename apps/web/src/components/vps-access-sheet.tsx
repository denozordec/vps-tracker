import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { Button } from '@cfdm/ui/components/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@cfdm/ui/components/sheet'
import { Tabs, TabsList, TabsTrigger } from '@cfdm/ui/components/tabs'
import { Badge } from '@cfdm/ui/components/badge'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { FormField } from '@/components/form-field'
import { LoadingButton } from '@/components/loading-button'
import { SelectField } from '@/components/select-field'
import { api, type SpaceVpsGrant } from '@/lib/api-client'
import { copyText } from '@/lib/clipboard'
import { useSpaceId } from '@/lib/space'
import { spacesKeys, spacesQueryOptions, snapshotKeys } from '@/queries/snapshot'
import type { Vps } from '@/types/entities'

type AccessMode = 'share' | 'assign'

type Props = {
  vps: Vps | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function VpsAccessSheet({ vps, open, onOpenChange }: Props) {
  const qc = useQueryClient()
  const { spaceId } = useSpaceId()
  const { data: spaces = [] } = useQuery(spacesQueryOptions())
  const fromSpaceId = spaceId ?? spaces.find((s) => s.kind === 'main')?.id ?? ''
  const targets = useMemo(
    () => spaces.filter((s) => s.id !== fromSpaceId && !s.deletedAt),
    [spaces, fromSpaceId],
  )
  const spaceNameById = useMemo(
    () => new Map(spaces.map((s) => [s.id, s.name])),
    [spaces],
  )

  const [mode, setMode] = useState<AccessMode>('share')
  const [toSpaceId, setToSpaceId] = useState<string | null>(null)
  const [permission, setPermission] = useState<'read' | 'write'>('read')
  const [assignConfirmOpen, setAssignConfirmOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    setMode('share')
    setToSpaceId(null)
    setPermission('read')
    setAssignConfirmOpen(false)
  }, [open, vps?.id])

  const grantsQuery = useQuery({
    queryKey: [...spacesKeys.all, fromSpaceId, 'vps-grants', vps?.id],
    queryFn: () => api.fetchSpaceGrants(fromSpaceId),
    enabled: open && Boolean(fromSpaceId) && Boolean(vps?.id),
  })

  const outgoingForVps = useMemo(() => {
    const outgoing = (grantsQuery.data?.outgoing ?? []) as SpaceVpsGrant[]
    if (!vps?.id) return []
    return outgoing.filter((g) => g.vpsId === vps.id)
  }, [grantsQuery.data, vps?.id])

  const spaceOptions = useMemo(
    () => targets.map((s) => ({ value: s.id, label: s.name })),
    [targets],
  )

  const permissionOptions = useMemo(
    () => [
      { value: 'read', label: 'Чтение' },
      { value: 'write', label: 'Запись' },
    ],
    [],
  )

  const invalidate = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: snapshotKeys.all }),
      qc.invalidateQueries({ queryKey: spacesKeys.all }),
    ])
  }

  const shareMutation = useMutation({
    mutationFn: () =>
      api.shareVps(fromSpaceId, vps!.id, {
        toSpaceId: toSpaceId!,
        permission,
      }),
    onSuccess: async () => {
      toast.success('Доступ выдан')
      onOpenChange(false)
      await invalidate()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const assignMutation = useMutation({
    mutationFn: () => api.assignVps(fromSpaceId, vps!.id, toSpaceId!),
    onSuccess: async () => {
      toast.success('Сервер перенесён')
      onOpenChange(false)
      await invalidate()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const revokeMutation = useMutation({
    mutationFn: (grantId: string) => api.revokeVpsGrant(fromSpaceId, grantId),
    onSuccess: async () => {
      toast.success('Доступ отозван')
      await invalidate()
      await grantsQuery.refetch()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const vpsLabel = vps?.ip || vps?.dns || vps?.id || ''
  const canSubmit = Boolean(toSpaceId && vps && fromSpaceId && targets.length > 0)
  const busy = shareMutation.isPending || assignMutation.isPending

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-md">
        <SheetHeader className="shrink-0 border-b border-border/50">
          <SheetTitle>Доступ к серверу</SheetTitle>
          <SheetDescription className="flex flex-col gap-1">
            {vps?.ip ? (
              <button
                type="button"
                className="text-foreground w-fit font-medium underline-offset-4 hover:underline"
                onClick={() => void copyText(vps.ip, 'IP скопирован')}
              >
                {vps.ip}
              </button>
            ) : (
              <span>{vpsLabel}</span>
            )}
            <span>
              {mode === 'share'
                ? 'Поделиться — сервер остаётся здесь, в целевом пространстве появится доступ.'
                : 'Перенести — сервер уйдёт в другое пространство; привязка к аккаунту провайдера сбросится.'}
            </span>
          </SheetDescription>
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
          <Tabs
            value={mode}
            onValueChange={(v) => setMode((v as AccessMode) ?? 'share')}
          >
            <TabsList variant="line" className="gap-5">
              <TabsTrigger
                value="share"
                className="text-muted-foreground hover:text-foreground h-auto gap-2 px-0 pb-3 after:bottom-0"
              >
                Поделиться
              </TabsTrigger>
              <TabsTrigger
                value="assign"
                className="text-muted-foreground hover:text-foreground h-auto gap-2 px-0 pb-3 after:bottom-0"
              >
                Перенести
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {targets.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Нет других пространств. Создайте пространство, чтобы поделиться или перенести сервер.
            </p>
          ) : (
            <div className="flex flex-col gap-4">
              <FormField label="Целевое пространство" htmlFor="access-to-space">
                <SelectField
                  triggerId="access-to-space"
                  options={spaceOptions}
                  value={toSpaceId}
                  onValueChange={setToSpaceId}
                  placeholder="Выберите пространство"
                />
              </FormField>

              {mode === 'share' ? (
                <FormField
                  label="Права"
                  htmlFor="access-permission"
                  description="Чтение — только просмотр; запись — можно редактировать"
                >
                  <SelectField
                    triggerId="access-permission"
                    options={permissionOptions}
                    value={permission}
                    onValueChange={(v) => setPermission((v as 'read' | 'write') ?? 'read')}
                  />
                </FormField>
              ) : null}
            </div>
          )}

          <section className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold">Текущие доступы</h3>
            {grantsQuery.isLoading ? (
              <p className="text-muted-foreground text-sm">Загрузка…</p>
            ) : outgoingForVps.length === 0 ? (
              <p className="text-muted-foreground text-sm">Нет выданных доступов для этого сервера</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {outgoingForVps.map((grant) => (
                  <li
                    key={grant.id}
                    className="border-border/50 flex items-center justify-between gap-2 rounded-lg border px-3 py-2"
                  >
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <span className="truncate text-sm font-medium">
                        {spaceNameById.get(grant.toSpaceId) ?? grant.toSpaceId}
                      </span>
                      <Badge variant="secondary" className="w-fit">
                        {grant.permission === 'write' ? 'Запись' : 'Чтение'}
                      </Badge>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={revokeMutation.isPending}
                      onClick={() => revokeMutation.mutate(grant.id)}
                    >
                      Отозвать
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <SheetFooter className="shrink-0 border-t border-border/50 sm:flex-col">
          {mode === 'share' ? (
            <LoadingButton
              type="button"
              loading={shareMutation.isPending}
              disabled={!canSubmit || busy}
              onClick={() => shareMutation.mutate()}
            >
              Поделиться
            </LoadingButton>
          ) : (
            <>
              <LoadingButton
                type="button"
                variant="outline"
                loading={assignMutation.isPending}
                disabled={!canSubmit || busy}
                onClick={() => setAssignConfirmOpen(true)}
              >
                Перенести
              </LoadingButton>
              <ConfirmDialog
                open={assignConfirmOpen}
                onOpenChange={setAssignConfirmOpen}
                title="Перенести сервер?"
                description="Привязка к аккаунту провайдера будет сброшена. Все выданные доступы (share) для этого сервера будут отозваны."
                confirmLabel="Перенести"
                destructive
                onConfirm={() => assignMutation.mutate()}
              />
            </>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
