import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Edge, Node, Viewport } from '@xyflow/react'
import { LockIcon, NetworkIcon, PlusIcon, PencilIcon, Trash2Icon } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@cfdm/ui/components/button'
import { Input } from '@cfdm/ui/components/input'
import { Skeleton } from '@cfdm/ui/components/skeleton'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@cfdm/ui/components/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@cfdm/ui/components/alert-dialog'
import { EmptyState } from '@/components/empty-state'
import { TopologyCanvas } from '@/components/reui-kit/topology-canvas'
import { TopologyEditor } from '@/components/topology/topology-editor'
import type { TopologyNodeData, TopologyNodeType } from '@/components/topology/types'
import { api, ApiError } from '@/lib/api-client'
import { getStoredSpaceId } from '@/lib/space'
import {
  topologyDetailQueryOptions,
  topologyKeys,
  topologyListQueryOptions,
} from '@/queries/topology'
import { snapshotQueryOptions } from '@/queries/snapshot'
import type { TopologyDocument } from '@cfdm/shared/contracts/topology'
import { cn } from '@cfdm/ui/lib/utils'

export const Route = createFileRoute('/_auth/topology')({
  component: TopologyPage,
})

type FlowNode = Node<TopologyNodeData, TopologyNodeType>

function TopologyPage() {
  const spaceId = getStoredSpaceId()
  const qc = useQueryClient()
  const listQuery = useQuery(topologyListQueryOptions(spaceId))
  const [activeId, setActiveId] = useState<string | null>(null)
  const [renameOpen, setRenameOpen] = useState(false)
  const [renameValue, setRenameValue] = useState('')
  const [deleteOpen, setDeleteOpen] = useState(false)

  useQuery(snapshotQueryOptions(spaceId))

  useEffect(() => {
    if (!listQuery.data?.length) {
      setActiveId(null)
      return
    }
    if (!activeId || !listQuery.data.some((d) => d.id === activeId)) {
      setActiveId(listQuery.data[0]!.id)
    }
  }, [listQuery.data, activeId])

  const detailQuery = useQuery({
    ...topologyDetailQueryOptions(activeId ?? '', spaceId),
    enabled: Boolean(activeId),
  })

  const updatedAtRef = useRef(detailQuery.data?.updatedAt)
  useEffect(() => {
    updatedAtRef.current = detailQuery.data?.updatedAt
  }, [detailQuery.data?.updatedAt])

  const createMutation = useMutation({
    mutationFn: (name: string) => api.createTopology({ name }),
    onSuccess: async (created) => {
      await qc.invalidateQueries({ queryKey: topologyKeys.list(spaceId) })
      setActiveId(created.id)
      toast.success('Схема создана')
    },
    onError: (err: Error) => toast.error(err.message || 'Не удалось создать схему'),
  })

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      ...payload
    }: {
      id: string
      name?: string
      document?: TopologyDocument
      locked?: boolean
      expectedUpdatedAt?: string
    }) => api.updateTopology(id, payload),
    onSuccess: (updated) => {
      updatedAtRef.current = updated.updatedAt
      qc.setQueryData(topologyKeys.detail(spaceId, updated.id), updated)
      void qc.invalidateQueries({ queryKey: topologyKeys.list(spaceId) })
    },
    onError: (err: Error) => {
      if (err instanceof ApiError && err.status === 409) {
        toast.error('Схема изменена на другом устройстве — обновляем')
        void qc.invalidateQueries({
          queryKey: topologyKeys.detail(spaceId, activeId ?? ''),
        })
        return
      }
      toast.error(err.message || 'Не удалось сохранить')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteTopology(id),
    onSuccess: async () => {
      setDeleteOpen(false)
      setActiveId(null)
      await qc.invalidateQueries({ queryKey: topologyKeys.list(spaceId) })
      toast.success('Схема удалена')
    },
    onError: (err: Error) => toast.error(err.message || 'Не удалось удалить'),
  })

  const handleDocumentChange = useCallback(
    (doc: { nodes: FlowNode[]; edges: Edge[]; viewport: Viewport }) => {
      if (!detailQuery.data || updateMutation.isPending) return
      updateMutation.mutate({
        id: detailQuery.data.id,
        document: {
          nodes: doc.nodes as unknown as TopologyDocument['nodes'],
          edges: doc.edges as unknown as TopologyDocument['edges'],
          viewport: doc.viewport,
        },
        expectedUpdatedAt: updatedAtRef.current,
      })
    },
    [detailQuery.data, updateMutation],
  )

  const tabs = useMemo(() => {
    const items = listQuery.data ?? []
    return (
      <div className="flex flex-wrap items-center gap-1">
        {items.map((d) => (
          <button
            key={d.id}
            type="button"
            onClick={() => setActiveId(d.id)}
            className={cn(
              'inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-sm transition-colors',
              d.id === activeId
                ? 'bg-muted font-medium text-foreground'
                : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
            )}
          >
            {d.name}
            {d.locked ? <LockIcon className="size-3 opacity-70" /> : null}
          </button>
        ))}
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Новая схема"
          disabled={createMutation.isPending}
          onClick={() => {
            const n = (listQuery.data?.length ?? 0) + 1
            createMutation.mutate(n === 1 ? 'Мастер' : `Схема ${n}`)
          }}
        >
          <PlusIcon />
        </Button>
      </div>
    )
  }, [listQuery.data, activeId, createMutation])

  if (listQuery.isLoading) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-[480px] w-full" />
      </div>
    )
  }

  if (listQuery.isError) {
    return (
      <EmptyState
        icon={NetworkIcon}
        title="Ошибка загрузки"
        description={
          listQuery.error instanceof Error
            ? listQuery.error.message
            : 'Не удалось загрузить схемы'
        }
        action={
          <Button variant="outline" onClick={() => void listQuery.refetch()}>
            Повторить
          </Button>
        }
      />
    )
  }

  const diagrams = listQuery.data ?? []

  if (diagrams.length === 0) {
    return (
      <div className="flex flex-1 flex-col gap-4">
        <EmptyState
          icon={NetworkIcon}
          title="Нет схем инфраструктуры"
          description="Создайте первую схему и разместите на ней VPS, связи и группы."
          action={
            <Button
              onClick={() => createMutation.mutate('Мастер')}
              disabled={createMutation.isPending}
            >
              <PlusIcon data-icon="inline-start" />
              Создать схему
            </Button>
          }
        />
      </div>
    )
  }

  const diagram = detailQuery.data
  const initialNodes = (diagram?.document.nodes ?? []) as unknown as FlowNode[]
  const initialEdges = (diagram?.document.edges ?? []) as unknown as Edge[]
  const initialViewport = diagram?.document.viewport as Viewport | undefined

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <TopologyCanvas
        description="Размещайте VPS, рисуйте связи и группируйте узлы. Изменения сохраняются автоматически."
        tabs={tabs}
        headerActions={
          diagram ? (
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setRenameValue(diagram.name)
                  setRenameOpen(true)
                }}
              >
                <PencilIcon data-icon="inline-start" />
                Переименовать
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setDeleteOpen(true)}
              >
                <Trash2Icon data-icon="inline-start" />
                Удалить
              </Button>
            </div>
          ) : null
        }
      >
        {detailQuery.isLoading || !diagram || !activeId ? (
          <Skeleton className="h-full min-h-[480px] w-full rounded-none" />
        ) : (
          <TopologyEditor
            key={diagram.id}
            diagramId={diagram.id}
            initialNodes={initialNodes}
            initialEdges={initialEdges}
            initialViewport={initialViewport}
            locked={diagram.locked}
            onDocumentChange={handleDocumentChange}
            onLockedChange={(locked) =>
              updateMutation.mutate({
                id: diagram.id,
                locked,
                expectedUpdatedAt: updatedAtRef.current,
              })
            }
          />
        )}
      </TopologyCanvas>

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Переименовать схему</DialogTitle>
          </DialogHeader>
          <Input
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            maxLength={120}
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRenameOpen(false)}>
              Отмена
            </Button>
            <Button
              type="button"
              disabled={!renameValue.trim() || !diagram}
              onClick={() => {
                if (!diagram) return
                updateMutation.mutate(
                  {
                    id: diagram.id,
                    name: renameValue.trim(),
                    expectedUpdatedAt: updatedAtRef.current,
                  },
                  { onSuccess: () => setRenameOpen(false) },
                )
              }}
            >
              Сохранить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить схему?</AlertDialogTitle>
            <AlertDialogDescription>
              Схема и расположение узлов будут удалены безвозвратно.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => {
                if (diagram) deleteMutation.mutate(diagram.id)
              }}
            >
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
