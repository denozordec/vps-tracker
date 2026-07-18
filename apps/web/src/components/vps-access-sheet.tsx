import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@cfdm/ui/components/sheet'

import { api } from '@/lib/api-client'
import { getStoredSpaceId } from '@/lib/space'
import { spacesQueryOptions, snapshotKeys } from '@/queries/snapshot'
import type { Vps } from '@/types/entities'

type Props = {
  vps: Vps | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function VpsAccessSheet({ vps, open, onOpenChange }: Props) {
  const qc = useQueryClient()
  const { data: spaces = [] } = useQuery(spacesQueryOptions())
  const fromSpaceId = getStoredSpaceId() ?? spaces.find((s) => s.kind === 'main')?.id ?? ''
  const targets = spaces.filter((s) => s.id !== fromSpaceId)
  const [toSpaceId, setToSpaceId] = useState('')
  const [permission, setPermission] = useState<'read' | 'write'>('read')

  const shareMutation = useMutation({
    mutationFn: () =>
      api.shareVps(fromSpaceId, vps!.id, {
        toSpaceId,
        permission,
      }),
    onSuccess: async () => {
      toast.success('Доступ выдан (share)')
      onOpenChange(false)
      await qc.invalidateQueries({ queryKey: snapshotKeys.all })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const assignMutation = useMutation({
    mutationFn: () => api.assignVps(fromSpaceId, vps!.id, toSpaceId),
    onSuccess: async () => {
      toast.success('Сервер перенесён (assign)')
      onOpenChange(false)
      await qc.invalidateQueries({ queryKey: snapshotKeys.all })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex flex-col gap-4 sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Доступ к серверу</SheetTitle>
          <SheetDescription>
            {vps ? `${vps.ip || vps.dns || vps.id}` : ''}
            {' — share оставляет запись здесь; assign переносит в другое пространство.'}
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-2">
          <Label>Целевое пространство</Label>
          <Select value={toSpaceId} onValueChange={(v) => setToSpaceId(v ?? '')}>
            <SelectTrigger>
              <SelectValue placeholder="Выберите пространство" />
            </SelectTrigger>
            <SelectContent>
              {targets.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-2">
          <Label>Права (для share)</Label>
          <Select
            value={permission}
            onValueChange={(v) => setPermission((v as 'read' | 'write') ?? 'read')}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="read">read</SelectItem>
              <SelectItem value="write">write</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <SheetFooter className="flex-col gap-2 sm:flex-col">
          <Button
            disabled={!toSpaceId || !vps || shareMutation.isPending}
            onClick={() => shareMutation.mutate()}
          >
            Share (ACL)
          </Button>
          <Button
            variant="outline"
            disabled={!toSpaceId || !vps || assignMutation.isPending}
            onClick={() => {
              if (
                !window.confirm(
                  'Перенести сервер? Привязка к аккаунту провайдера будет сброшена.',
                )
              ) {
                return
              }
              assignMutation.mutate()
            }}
          >
            Assign (перенос)
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
