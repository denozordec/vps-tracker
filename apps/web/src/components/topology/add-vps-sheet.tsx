import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@cfdm/ui/components/button'
import { Input } from '@cfdm/ui/components/input'
import { FormSheet } from '@/components/form-sheet'
import { snapshotQueryOptions } from '@/queries/snapshot'
import { vpsSpecsLine } from './types'
import type { Vps } from '@/types/entities'

interface AddVpsSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  existingVpsIds: Set<string>
  onAdd: (vpsIds: string[]) => void
}

export function AddVpsSheet({
  open,
  onOpenChange,
  existingVpsIds,
  onAdd,
}: AddVpsSheetProps) {
  const { data: snapshot } = useQuery(snapshotQueryOptions())
  const [q, setQ] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const list = useMemo(() => {
    const all = (snapshot?.vps ?? []) as Vps[]
    const term = q.trim().toLowerCase()
    return all
      .filter((v) => v.status !== 'archived')
      .filter((v) => {
        if (!term) return true
        return [v.dns, v.ip, v.purpose, v.project]
          .filter(Boolean)
          .some((s) => String(s).toLowerCase().includes(term))
      })
      .slice(0, 80)
  }, [snapshot?.vps, q])

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <FormSheet
      open={open}
      onOpenChange={(v) => {
        if (!v) {
          setSelected(new Set())
          setQ('')
        }
        onOpenChange(v)
      }}
      title="Добавить VPS на схему"
      description="Сервер появится на канве. Позицию и связи можно настроить вручную."
      submitLabel={`Добавить${selected.size ? ` (${selected.size})` : ''}`}
      submitDisabled={selected.size === 0}
      onSubmit={() => {
        onAdd([...selected])
        setSelected(new Set())
        setQ('')
        onOpenChange(false)
      }}
    >
      <Input
        placeholder="Поиск по IP, DNS, проекту…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <div className="flex max-h-[50vh] flex-col gap-1 overflow-y-auto">
        {list.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Нет подходящих VPS</p>
        ) : (
          list.map((v) => {
            const already = existingVpsIds.has(v.id)
            const checked = selected.has(v.id)
            return (
              <button
                key={v.id}
                type="button"
                disabled={already}
                onClick={() => toggle(v.id)}
                className="flex flex-col gap-0.5 rounded-md border border-transparent px-2 py-2 text-left hover:bg-muted disabled:opacity-50"
                data-selected={checked || undefined}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium">
                    {v.dns || v.ip}
                  </span>
                  {already ? (
                    <span className="text-[10px] text-muted-foreground">уже на схеме</span>
                  ) : (
                    <span
                      className={
                        checked
                          ? 'size-2 rounded-full bg-primary'
                          : 'size-2 rounded-full border border-border'
                      }
                    />
                  )}
                </div>
                <span className="font-mono text-[11px] text-muted-foreground">{v.ip}</span>
                <span className="text-[11px] text-muted-foreground">{vpsSpecsLine(v)}</span>
              </button>
            )
          })
        )}
      </div>
      {selected.size > 0 ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setSelected(new Set())}
        >
          Сбросить выбор
        </Button>
      ) : null}
    </FormSheet>
  )
}
