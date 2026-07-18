import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@cfdm/ui/components/button'
import { Input } from '@cfdm/ui/components/input'
import { Label } from '@cfdm/ui/components/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@cfdm/ui/components/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@cfdm/ui/components/table'

import { PageHeader } from '@/components/page-header'
import { PageShell } from '@/components/page-shell'
import { QueryState } from '@/components/query-state'
import { api } from '@/lib/api-client'
import { useSpaceId } from '@/lib/space'
import { spacesKeys, spacesQueryOptions } from '@/queries/snapshot'

export const Route = createFileRoute('/_auth/spaces')({
  component: SpacesPage,
})

type MemberRow = {
  spaceId: string
  userId: string
  role: string
  createdAt: string
}

function SpacesPage() {
  const qc = useQueryClient()
  const { spaceId } = useSpaceId()
  const { data: spaces = [] } = useQuery(spacesQueryOptions())
  const current = spaces.find((s) => s.id === spaceId) ?? spaces[0]
  const currentId = current?.id ?? ''

  const membersQuery = useQuery({
    queryKey: spacesKeys.members(currentId),
    queryFn: () => api.fetchSpaceMembers(currentId),
    enabled: Boolean(currentId),
  })

  const [userId, setUserId] = useState('')
  const [role, setRole] = useState('member')

  const addMutation = useMutation({
    mutationFn: () =>
      api.addSpaceMember(currentId, { userId: userId.trim(), role }),
    onSuccess: async () => {
      setUserId('')
      toast.success('Участник добавлен')
      await qc.invalidateQueries({ queryKey: spacesKeys.members(currentId) })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const removeMutation = useMutation({
    mutationFn: (uid: string) => api.removeSpaceMember(currentId, uid),
    onSuccess: async () => {
      toast.success('Участник удалён')
      await qc.invalidateQueries({ queryKey: spacesKeys.members(currentId) })
    },
    onError: (e: Error) => toast.error(e.message),
  })

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

      <QueryState
        data={membersQuery.data as MemberRow[] | undefined}
        isLoading={membersQuery.isLoading}
        isError={membersQuery.isError}
        error={membersQuery.error}
        onRetry={() => void membersQuery.refetch()}
        empty={Boolean(membersQuery.data && membersQuery.data.length === 0)}
        emptyTitle="Нет участников"
        emptyDescription="Добавьте userId из auth-portal"
      >
        {(members) => (
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-3 rounded-lg border p-4 md:flex-row md:items-end">
              <div className="flex flex-1 flex-col gap-2">
                <Label htmlFor="member-user-id">User ID (из auth-portal)</Label>
                <Input
                  id="member-user-id"
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  placeholder="uuid пользователя"
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
                disabled={!userId.trim() || addMutation.isPending}
                onClick={() => addMutation.mutate()}
              >
                Добавить
              </Button>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User ID</TableHead>
                  <TableHead>Роль</TableHead>
                  <TableHead className="w-28" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((m) => (
                  <TableRow key={`${m.spaceId}-${m.userId}`}>
                    <TableCell className="font-mono text-xs">{m.userId}</TableCell>
                    <TableCell>{m.role}</TableCell>
                    <TableCell>
                      {m.role !== 'owner' ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => removeMutation.mutate(m.userId)}
                        >
                          Удалить
                        </Button>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </QueryState>
    </PageShell>
  )
}
