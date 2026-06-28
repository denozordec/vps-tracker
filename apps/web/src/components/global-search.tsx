import { useEffect, useMemo } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import {
  ServerIcon,
  WalletIcon,
  Building2Icon,
  FolderKanbanIcon,
  LayoutDashboardIcon,
  SearchIcon,
} from 'lucide-react'

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@cfdm/ui/components/command'
import { snapshotQueryOptions } from '@/queries/snapshot'
import { providerByIdMap } from '@/lib/billmanager'

interface GlobalSearchProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function GlobalSearch({ open, onOpenChange }: GlobalSearchProps) {
  const navigate = useNavigate()
  const { data: snapshot } = useQuery({ ...snapshotQueryOptions(), enabled: open })
  const providerById = snapshot ? providerByIdMap(snapshot.providers) : new Map()

  const go = (to: string, search?: Record<string, string>) => {
    onOpenChange(false)
    void navigate({ to, search })
  }

  const vpsItems = useMemo(() => snapshot?.vps ?? [], [snapshot])
  const accountItems = useMemo(() => snapshot?.providerAccounts ?? [], [snapshot])
  const projectItems = useMemo(() => snapshot?.serverProjects ?? [], [snapshot])

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange} title="Поиск" description="VPS, аккаунты, проекты и навигация">
      <CommandInput placeholder="IP, DNS, проект, аккаунт…" />
      <CommandList>
        <CommandEmpty>Ничего не найдено</CommandEmpty>
        <CommandGroup heading="Навигация">
          <CommandItem onSelect={() => go('/dashboard')}>
            <LayoutDashboardIcon />
            Дашборд
          </CommandItem>
          <CommandItem onSelect={() => go('/vps')}>
            <ServerIcon />
            Все VPS
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="VPS">
          {vpsItems.slice(0, 50).map((v) => (
            <CommandItem key={v.id} value={`${v.ip} ${v.dns} ${v.project}`} onSelect={() => go('/vps/$vpsId', { vpsId: v.id })}>
              <ServerIcon />
              <span>{v.ip || v.dns || v.id}</span>
              {v.project ? <span className="text-muted-foreground text-xs">· {v.project}</span> : null}
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandGroup heading="Аккаунты">
          {accountItems.map((a) => (
            <CommandItem
              key={a.id}
              value={`${a.name} ${providerById.get(a.providerId)?.name ?? ''}`}
              onSelect={() => go('/accounts')}
            >
              <WalletIcon />
              {a.name}
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandGroup heading="Проекты">
          {projectItems.map((p) => {
            const row = p as { id: string; name: string }
            return (
              <CommandItem key={row.id} value={row.name} onSelect={() => go('/vps', { project: row.name })}>
                <FolderKanbanIcon />
                {row.name}
              </CommandItem>
            )
          })}
        </CommandGroup>
        <CommandGroup heading="Хостеры">
          {(snapshot?.providers ?? []).map((p) => (
            <CommandItem key={p.id} value={p.name} onSelect={() => go('/providers')}>
              <Building2Icon />
              {p.name}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}

export function useGlobalSearchHotkey(onOpen: () => void) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        onOpen()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onOpen])
}

export function GlobalSearchTrigger({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="hidden items-center gap-2 rounded-md border bg-muted/50 px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted md:flex"
    >
      <SearchIcon className="size-4" />
      <span>Поиск</span>
      <kbd className="pointer-events-none rounded border bg-background px-1.5 font-mono text-xs">Ctrl+K</kbd>
    </button>
  )
}
