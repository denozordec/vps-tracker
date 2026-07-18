import { useEffect, useState } from 'react'
import { Input } from '@cfdm/ui/components/input'
import { Textarea } from '@cfdm/ui/components/textarea'
import { FormSheet } from '@/components/form-sheet'
import { FormField } from '@/components/form-field'
import { SelectField } from '@/components/select-field'
import {
  SHAPE_KIND_OPTIONS,
  type GroupNodeData,
  type NoteNodeData,
  type ShapeKind,
  type ShapeNodeData,
  type TopologyNodeType,
} from './types'

export type EditableElement =
  | { kind: 'shape'; id: string; data: ShapeNodeData }
  | { kind: 'note'; id: string; data: NoteNodeData }
  | { kind: 'group'; id: string; data: GroupNodeData }

interface ElementEditSheetProps {
  element: EditableElement | null
  open: boolean
  locked?: boolean
  onOpenChange: (open: boolean) => void
  onSave: (id: string, type: TopologyNodeType, data: ShapeNodeData | NoteNodeData | GroupNodeData) => void
}

export function ElementEditSheet({
  element,
  open,
  locked,
  onOpenChange,
  onSave,
}: ElementEditSheetProps) {
  const [label, setLabel] = useState('')
  const [text, setText] = useState('')
  const [notes, setNotes] = useState('')
  const [kind, setKind] = useState<ShapeKind>('rect')

  useEffect(() => {
    if (!element) return
    if (element.kind === 'shape') {
      setLabel(element.data.label ?? '')
      setKind(element.data.kind ?? 'rect')
      setText('')
      setNotes('')
    } else if (element.kind === 'note') {
      setText(element.data.text ?? '')
      setLabel('')
      setNotes('')
    } else {
      setLabel(element.data.label ?? '')
      setNotes(element.data.notes ?? '')
      setText('')
    }
  }, [element, open])

  const title =
    element?.kind === 'shape'
      ? 'Параметры блока'
      : element?.kind === 'note'
        ? 'Параметры заметки'
        : 'Параметры группы'

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={
        locked
          ? 'Схема заблокирована — только просмотр'
          : 'Изменения сохранятся на схеме'
      }
      submitLabel="Сохранить"
      submitDisabled={locked || !element}
      onSubmit={() => {
        if (!element || locked) return
        if (element.kind === 'shape') {
          onSave(element.id, 'shape', { kind, label: label.trim() || 'Блок' })
        } else if (element.kind === 'note') {
          onSave(element.id, 'note', { text: text.trim() || 'Заметка' })
        } else {
          onSave(element.id, 'group', {
            label: label.trim() || 'Группа',
            notes: notes.trim() || undefined,
          })
        }
        onOpenChange(false)
      }}
    >
      {element?.kind === 'shape' ? (
        <>
          <FormField label="Подпись" htmlFor="shape-label">
            <Input
              id="shape-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              disabled={locked}
              maxLength={80}
            />
          </FormField>
          <FormField label="Форма" htmlFor="shape-kind">
            <SelectField
              triggerId="shape-kind"
              value={kind}
              onValueChange={(v) => {
                if (v === 'rect' || v === 'ellipse' || v === 'diamond') setKind(v)
              }}
              options={SHAPE_KIND_OPTIONS}
              disabled={locked}
            />
          </FormField>
        </>
      ) : null}

      {element?.kind === 'note' ? (
        <FormField label="Текст" htmlFor="note-text">
          <Textarea
            id="note-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={locked}
            rows={6}
            maxLength={2000}
          />
        </FormField>
      ) : null}

      {element?.kind === 'group' ? (
        <>
          <FormField label="Название" htmlFor="group-label">
            <Input
              id="group-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              disabled={locked}
              maxLength={80}
            />
          </FormField>
          <FormField label="Заметки" htmlFor="group-notes">
            <Textarea
              id="group-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={locked}
              rows={4}
              maxLength={1000}
              placeholder="Например: subnet 192.168.0.0/24"
            />
          </FormField>
        </>
      ) : null}
    </FormSheet>
  )
}
