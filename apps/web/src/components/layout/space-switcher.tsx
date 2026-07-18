import { useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckIcon, ChevronsUpDownIcon, PlusIcon, UsersIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@cfdm/ui/components/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@cfdm/ui/components/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@cfdm/ui/components/dialog'
import { Input } from '@cfdm/ui/components/input'
import { Label } from '@cfdm/ui/components/label'
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@cfdm/ui/components/sidebar'

import { api } from '@/lib/api-client'
import { useSpaceId, type SpaceDto } from '@/lib/space'
import { spacesKeys, spacesQueryOptions, snapshotKeys } from '@/queries/snapshot'

export function SpaceSwitcher() {
  const { isMobile } = useSidebar()
  const qc = useQueryClient()
  const { spaceId, setSpaceId } = useSpaceId()
  const { data: spaces = [] } = useQuery(spacesQueryOptions())
  const currentId = spaceId ?? spaces[0]?.id
  const current = spaces.find((s) => s.id === currentId) ?? spaces[0]
  const [createOpen, setCreateOpen] = useState(false)
  const [name, setName] = useState('')

  useEffect(() => {
    if (!spaceId && spaces[0]?.id) {
      setSpaceId(spaces[0].id)
    }
  }, [spaceId, spaces, setSpaceId])

  function selectSpace(space: SpaceDto) {
    if (space.id === currentId) return
    setSpaceId(space.id)
    void qc.invalidateQueries({ queryKey: snapshotKeys.all })
    void qc.invalidateQueries({ queryKey: spacesKeys.all })
    toast.success(`Пространство: ${space.name}`)
  }

  function openCreateDialog() {
    queueMicrotask(() => setCreateOpen(true))
  }

  async function handleCreate() {
    const n = name.trim()
    if (!n) return
    try {
      const created = await api.createSpace({ name: n })
      setSpaceId(created.id)
      setCreateOpen(false)
      setName('')
      await qc.invalidateQueries({ queryKey: spacesKeys.all })
      await qc.invalidateQueries({ queryKey: snapshotKeys.all })
      toast.success('Пространство создано')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Ошибка создания')
    }
  }

  if (spaces.length === 0) {
    return (
      <div className="px-2 py-1.5 text-xs text-muted-foreground">Пространства…</div>
    )
  }

  return (
    <>
      <SidebarMenu>
        <SidebarMenuItem>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <SidebarMenuButton
                  size="lg"
                  className="data-popup-open:bg-muted"
                />
              }
            >
              <div
                className="flex aspect-square size-8 items-center justify-center rounded-md bg-muted text-muted-foreground"
                aria-hidden
              >
                <UsersIcon className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">
                  {current?.name ?? 'Пространство'}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  {current?.kind === 'main' ? 'Основное' : 'Личное'}
                  {current?.role ? ` · ${current.role}` : ''}
                </span>
              </div>
              <ChevronsUpDownIcon className="ml-auto size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className="min-w-56 rounded-lg"
              side={isMobile ? 'bottom' : 'right'}
              align="start"
              sideOffset={4}
            >
              <DropdownMenuGroup>
                <DropdownMenuLabel>Пространства</DropdownMenuLabel>
                {spaces.map((s) => (
                  <DropdownMenuItem
                    key={s.id}
                    onClick={() => selectSpace(s)}
                  >
                    <UsersIcon className="size-4" />
                    <span className="truncate">{s.name}</span>
                    {s.id === current?.id ? (
                      <CheckIcon className="ml-auto size-4" />
                    ) : null}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem onClick={openCreateDialog}>
                  <PlusIcon className="size-4" />
                  Создать пространство
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenu>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Новое пространство</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="space-name">Название</Label>
            <Input
              id="space-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Моя команда"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Отмена
            </Button>
            <Button onClick={() => void handleCreate()}>Создать</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
