import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { Button } from '@cfdm/ui/components/button'
import { Input } from '@cfdm/ui/components/input'
import { TabsContent } from '@cfdm/ui/components/tabs'
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from '@cfdm/ui/components/item'
import { Badge } from '@/components/reui/badge'
import { CountedLineTabs } from '@/components/counted-line-tabs'
import { EmptyState } from '@/components/empty-state'
import { FormSheet } from '@/components/form-sheet'
import { snapshotQueryOptions } from '@/queries/snapshot'
import { aggregateCfdmServices, type CfdmTopologyService } from './cfdm-services'
import { lbModeBadgeVariant, lbModeLabel, vpsSpecsLine } from './types'
import type { Vps } from '@/types/entities'

interface AddVpsSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  existingVpsIds: Set<string>
  existingCfdmServiceIds: Set<number>
  onAdd: (vpsIds: string[]) => void
  onAddServices: (services: CfdmTopologyService[]) => void
}

export function AddVpsSheet({
  open,
  onOpenChange,
  existingVpsIds,
  existingCfdmServiceIds,
  onAdd,
  onAddServices,
}: AddVpsSheetProps) {
  const { data: snapshot } = useQuery(snapshotQueryOptions())
  const [tab, setTab] = useState('vps')
  const [q, setQ] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [selectedServices, setSelectedServices] = useState<Set<number>>(new Set())

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

  const services = useMemo(
    () => aggregateCfdmServices(snapshot?.vpsDomains ?? []),
    [snapshot?.vpsDomains],
  )

  const filteredServices = useMemo(() => {
    const term = q.trim().toLowerCase()
    if (!term) return services
    return services.filter((s) => {
      if (s.name.toLowerCase().includes(term) || s.slug.toLowerCase().includes(term)) return true
      return s.fqdns.some((f) => f.toLowerCase().includes(term))
    })
  }, [services, q])

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleService(id: number) {
    setSelectedServices((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function reset() {
    setSelected(new Set())
    setSelectedServices(new Set())
    setQ('')
    setTab('vps')
  }

  const submitCount = tab === 'cfdm' ? selectedServices.size : selected.size
  const submitDisabled = submitCount === 0

  return (
    <FormSheet
      open={open}
      onOpenChange={(v) => {
        if (!v) reset()
        onOpenChange(v)
      }}
      title={tab === 'cfdm' ? 'Добавить сервис CFDM' : 'Добавить VPS на схему'}
      description={
        tab === 'cfdm'
          ? 'Серверы сервиса появятся в группе. Тип резервирования — из CFDM.'
          : 'Сервер появится на канве. Позицию и связи можно настроить вручную.'
      }
      submitLabel={`Добавить${submitCount ? ` (${submitCount})` : ''}`}
      submitDisabled={submitDisabled}
      onSubmit={() => {
        if (tab === 'cfdm') {
          const picked = services.filter((s) => selectedServices.has(s.serviceId))
          onAddServices(picked)
        } else {
          onAdd([...selected])
        }
        reset()
        onOpenChange(false)
      }}
    >
      <CountedLineTabs
        tabs={[
          { id: 'vps', label: 'VPS', count: list.length },
          { id: 'cfdm', label: 'Сервисы CFDM', count: services.length },
        ]}
        value={tab}
        onValueChange={setTab}
        className="flex flex-col gap-3"
      >
        <Input
          placeholder={
            tab === 'cfdm' ? 'Поиск по сервису, FQDN…' : 'Поиск по IP, DNS, проекту…'
          }
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />

        <TabsContent value="vps" className="mt-0 flex flex-col gap-1">
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
                      <span className="truncate text-sm font-medium">{v.dns || v.ip}</span>
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
        </TabsContent>

        <TabsContent value="cfdm" className="mt-0 flex flex-col gap-1">
          {services.length === 0 ? (
            <EmptyState
              title="Нет сервисов CFDM"
              description="Включите интеграцию и синхронизируйте bindings — сервисы появятся здесь."
              centered={false}
              action={
                <Button variant="outline" size="sm" render={<Link to="/settings/integrations" />}>
                  Настройки интеграции
                </Button>
              }
            />
          ) : filteredServices.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Нет подходящих сервисов</p>
          ) : (
            <ItemGroup className="max-h-[50vh] gap-1 overflow-y-auto">
              {filteredServices.map((s) => {
                const already = existingCfdmServiceIds.has(s.serviceId)
                const noServers = s.matchedVpsIds.length === 0
                const disabled = already || noServers
                const checked = selectedServices.has(s.serviceId)
                return (
                  <Item
                    key={s.serviceId}
                    size="sm"
                    variant={checked ? 'muted' : 'default'}
                    render={
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => toggleService(s.serviceId)}
                      />
                    }
                    className="w-full text-left disabled:opacity-50"
                    data-selected={checked || undefined}
                  >
                    <ItemContent className="gap-0.5">
                      <ItemTitle className="flex flex-wrap items-center gap-1.5">
                        <span className="truncate">{s.name}</span>
                        {s.lbMode ? (
                          <Badge variant={lbModeBadgeVariant(s.lbMode)} size="xs">
                            {lbModeLabel(s.lbMode)}
                          </Badge>
                        ) : null}
                      </ItemTitle>
                      <ItemDescription>
                        {s.fqdns.slice(0, 2).join(', ')}
                        {s.fqdns.length > 2 ? ` +${s.fqdns.length - 2}` : ''}
                        {' · '}
                        {s.matchedVpsIds.length} серв.
                      </ItemDescription>
                    </ItemContent>
                    <ItemActions>
                      {already ? (
                        <span className="text-[10px] text-muted-foreground">уже на схеме</span>
                      ) : noServers ? (
                        <span className="text-[10px] text-muted-foreground">нет серверов</span>
                      ) : (
                        <span
                          className={
                            checked
                              ? 'size-2 rounded-full bg-primary'
                              : 'size-2 rounded-full border border-border'
                          }
                        />
                      )}
                    </ItemActions>
                  </Item>
                )
              })}
            </ItemGroup>
          )}
        </TabsContent>
      </CountedLineTabs>

      {(tab === 'vps' ? selected.size : selectedServices.size) > 0 ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            setSelected(new Set())
            setSelectedServices(new Set())
          }}
        >
          Сбросить выбор
        </Button>
      ) : null}
    </FormSheet>
  )
}
