import { useEffect, useState } from 'react'
import { Input } from '@cfdm/ui/components/input'
import { Textarea } from '@cfdm/ui/components/textarea'
import { FormSheet } from '@/components/form-sheet'
import { FormField } from '@/components/form-field'
import { SelectField } from '@/components/select-field'
import {
  EDGE_DIRECTION_OPTIONS,
  EDGE_RELATION_OPTIONS,
  defaultEdgeData,
  type TopologyEdgeData,
  type TopologyEdgeDirection,
  type TopologyEdgeRelation,
} from './types'

interface EdgeEditSheetProps {
  edgeId: string | null
  data: TopologyEdgeData | null
  open: boolean
  locked?: boolean
  onOpenChange: (open: boolean) => void
  onSave: (edgeId: string, data: TopologyEdgeData) => void
}

export function EdgeEditSheet({
  edgeId,
  data,
  open,
  locked,
  onOpenChange,
  onSave,
}: EdgeEditSheetProps) {
  const [relation, setRelation] = useState<TopologyEdgeRelation>('network')
  const [label, setLabel] = useState('')
  const [lineStyle, setLineStyle] = useState<'solid' | 'dashed'>('solid')
  const [direction, setDirection] = useState<TopologyEdgeDirection>('forward')
  const [protocol, setProtocol] = useState('')
  const [localIp, setLocalIp] = useState('')
  const [remoteIp, setRemoteIp] = useState('')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    const d = data ?? defaultEdgeData()
    setRelation(d.relation ?? 'network')
    setLabel(d.label ?? '')
    setLineStyle(d.lineStyle ?? 'solid')
    setDirection(d.direction ?? 'forward')
    setProtocol(d.protocol ?? '')
    setLocalIp(d.localIp ?? '')
    setRemoteIp(d.remoteIp ?? '')
    setNotes(d.notes ?? '')
  }, [data, edgeId, open])

  const showTunnelIps = relation === 'vpn' || relation === 'tunnel'

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Параметры связи"
      description={
        locked
          ? 'Схема заблокирована — только просмотр'
          : 'Тип, подпись, протокол и IP отображаются на схеме вместе'
      }
      submitLabel="Сохранить"
      submitDisabled={locked || !edgeId}
      onSubmit={() => {
        if (!edgeId || locked) return
        onSave(edgeId, {
          relation,
          label: label.trim(),
          lineStyle,
          direction,
          protocol: protocol.trim(),
          localIp: localIp.trim(),
          remoteIp: remoteIp.trim(),
          notes: notes.trim(),
        })
        onOpenChange(false)
      }}
    >
      <FormField label="Тип связи" htmlFor="edge-relation">
        <SelectField
          triggerId="edge-relation"
          value={relation}
          onValueChange={(v) => {
            if (v && EDGE_RELATION_OPTIONS.some((o) => o.value === v)) {
              setRelation(v as TopologyEdgeRelation)
            }
          }}
          options={EDGE_RELATION_OPTIONS}
          disabled={locked}
        />
      </FormField>
      <FormField label="Подпись на схеме" htmlFor="edge-label">
        <Input
          id="edge-label"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          disabled={locked}
          maxLength={60}
          placeholder="Например: eth0 / uplink — рядом с протоколом"
        />
      </FormField>
      <FormField label="Направление" htmlFor="edge-direction">
        <SelectField
          triggerId="edge-direction"
          value={direction}
          onValueChange={(v) => {
            if (v === 'forward' || v === 'bidirectional' || v === 'none') setDirection(v)
          }}
          options={EDGE_DIRECTION_OPTIONS}
          disabled={locked}
        />
      </FormField>
      <FormField label="Стиль линии" htmlFor="edge-style">
        <SelectField
          triggerId="edge-style"
          value={lineStyle}
          onValueChange={(v) => {
            if (v === 'solid' || v === 'dashed') setLineStyle(v)
          }}
          options={[
            { value: 'solid', label: 'Сплошная' },
            { value: 'dashed', label: 'Пунктир' },
          ]}
          disabled={locked}
        />
      </FormField>
      <FormField label="Протокол / порт" htmlFor="edge-protocol">
        <Input
          id="edge-protocol"
          value={protocol}
          onChange={(e) => setProtocol(e.target.value)}
          disabled={locked}
          maxLength={40}
          placeholder="TCP/443, WireGuard, BGP…"
        />
      </FormField>
      {showTunnelIps ? (
        <>
          <FormField label="Локальный IP туннеля" htmlFor="edge-local-ip">
            <Input
              id="edge-local-ip"
              value={localIp}
              onChange={(e) => setLocalIp(e.target.value)}
              disabled={locked}
              maxLength={45}
              placeholder="10.8.0.1"
              className="font-mono"
            />
          </FormField>
          <FormField label="Удалённый IP туннеля" htmlFor="edge-remote-ip">
            <Input
              id="edge-remote-ip"
              value={remoteIp}
              onChange={(e) => setRemoteIp(e.target.value)}
              disabled={locked}
              maxLength={45}
              placeholder="10.8.0.2"
              className="font-mono"
            />
          </FormField>
        </>
      ) : null}
      <FormField label="Заметки" htmlFor="edge-notes">
        <Textarea
          id="edge-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          disabled={locked}
          rows={3}
          maxLength={500}
        />
      </FormField>
    </FormSheet>
  )
}
