import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronsUpDownIcon, PlusIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@cfdm/ui/components/button'
import {
  DropdownMenu,
  DropdownMenuContent,
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
} from '@cfdm/ui/components/sidebar'

import { api } from '@/lib/api-client'
import { getStoredSpaceId, setStoredSpaceId, type SpaceDto } from '@/lib/space'
import { spacesKeys, spacesQueryOptions, snapshotKeys } from '@/queries/snapshot'

export function SpaceSwitcher() {
  const qc = useQueryClient()
  const { data: spaces = [] } = useQuery(spacesQueryOptions())
  const currentId = getStoredSpaceId() ?? spaces[0]?.id
  const current = spaces.find((s) => s.id === currentId) ?? spaces[0]
  const [createOpen, setCreateOpen] = useState(false)
  const [name, setName] = useState('')

  useEffect(() => {
    if (!getStoredSpaceId() && spaces[0]?.id) {
      setStoredSpaceId(spaces[0].id)
    }
  }, [spaces])

  function selectSpace(space: SpaceDto) {
    setStoredSpaceId(space.id)
    void qc.invalidateQueries({ queryKey: snapshotKeys.all })
    void qc.invalidateQueries({ queryKey: spacesKeys.all })
    toast.success(`Пространство: ${space.name}`)
  }

  async function handleCreate() {
    const n = name.trim()
    if (!n) return
    try {
      const created = await api.createSpace({ name: n })
      setStoredSpaceId(created.id)
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
              render={<SidebarMenuButton size="lg" className="aria-expanded:bg-muted" />}
            >
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{current?.name ?? 'Пространство'}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {current?.kind === 'main' ? 'Основное' : 'Личное'}
                  {current?.role ? ` · ${current.role}` : ''}
                </span>
              </div>
              <ChevronsUpDownIcon className="ml-auto size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent className="min-w-56 rounded-lg" align="start" sideOffset={4}>
              <DropdownMenuLabel>Пространства</DropdownMenuLabel>
              {spaces.map((s) => (
                <DropdownMenuItem
                  key={s.id}
                  onClick={() => selectSpace(s)}
                  className={s.id === current?.id ? 'bg-accent' : undefined}
                >
                  <span className="truncate">{s.name}</span>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setCreateOpen(true)}>
                <PlusIcon className="size-4" />
                Создать пространство
              </DropdownMenuItem>
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
