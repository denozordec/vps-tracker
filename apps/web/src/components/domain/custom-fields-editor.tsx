import { useRef, useState, type MutableRefObject } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVerticalIcon, PlusIcon, Trash2Icon } from 'lucide-react'
import {
  useFieldArray,
  Controller,
  type Control,
  type FieldErrors,
  type UseFormSetValue,
} from 'react-hook-form'

import { Button } from '@cfdm/ui/components/button'
import { Input } from '@cfdm/ui/components/input'
import { FormField } from '@/components/form-field'
import { SelectField } from '@/components/select-field'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { EmptyState } from '@/components/empty-state'
import { slugifyCustomFieldKey } from '@/lib/custom-fields'
import type { SettingsFormValues } from '@/lib/schemas'

const FIELD_TYPES = [
  { value: 'text', label: 'Текст' },
  { value: 'number', label: 'Число' },
  { value: 'bool', label: 'Да/Нет' },
] as const

interface CustomFieldsEditorProps {
  control: Control<SettingsFormValues>
  setValue: UseFormSetValue<SettingsFormValues>
  errors?: FieldErrors<SettingsFormValues>['customFields']
}

function SortableFieldRow({
  id,
  index,
  control,
  setValue,
  errors,
  onRemove,
  manualKeysRef,
}: {
  id: string
  index: number
  control: Control<SettingsFormValues>
  setValue: UseFormSetValue<SettingsFormValues>
  errors?: FieldErrors<SettingsFormValues>['customFields']
  onRemove: () => void
  manualKeysRef: MutableRefObject<Set<number>>
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  })
  const rowErrors = errors?.[index]
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex flex-col gap-3 rounded-lg border border-border p-3 sm:flex-row sm:items-start"
    >
      <button
        type="button"
        className="mt-2 flex size-8 shrink-0 cursor-grab items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground active:cursor-grabbing"
        aria-label="Перетащить"
        {...attributes}
        {...listeners}
      >
        <GripVerticalIcon className="size-4" />
      </button>
      <div className="grid flex-1 gap-3 sm:grid-cols-3">
        <Controller
          control={control}
          name={`customFields.${index}.label`}
          render={({ field }) => (
            <FormField
              label="Название"
              htmlFor={`custom-field-label-${index}`}
              error={rowErrors?.label?.message}
            >
              <Input
                id={`custom-field-label-${index}`}
                placeholder="Панель управления"
                value={field.value}
                onChange={field.onChange}
                onBlur={(e) => {
                  field.onBlur()
                  if (!manualKeysRef.current.has(index)) {
                    setValue(`customFields.${index}.key`, slugifyCustomFieldKey(e.target.value), {
                      shouldDirty: true,
                    })
                  }
                }}
              />
            </FormField>
          )}
        />
        <Controller
          control={control}
          name={`customFields.${index}.key`}
          render={({ field }) => (
            <FormField
              label="Ключ"
              htmlFor={`custom-field-key-${index}`}
              error={rowErrors?.key?.message}
              description="panel_url"
            >
              <Input
                id={`custom-field-key-${index}`}
                className="font-mono text-xs"
                placeholder="panel_url"
                value={field.value}
                onChange={(e) => {
                  manualKeysRef.current.add(index)
                  field.onChange(e)
                }}
                onBlur={field.onBlur}
              />
            </FormField>
          )}
        />
        <Controller
          control={control}
          name={`customFields.${index}.type`}
          render={({ field }) => (
            <FormField
              label="Тип"
              htmlFor={`custom-field-type-${index}`}
              error={rowErrors?.type?.message}
            >
              <SelectField
                triggerId={`custom-field-type-${index}`}
                value={field.value ?? 'text'}
                onValueChange={(v) => field.onChange(v ?? 'text')}
                options={[...FIELD_TYPES]}
              />
            </FormField>
          )}
        />
      </div>
      <ConfirmDialog
        trigger={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="mt-1 shrink-0 text-muted-foreground hover:text-destructive"
            aria-label="Удалить поле"
          >
            <Trash2Icon className="size-4" />
          </Button>
        }
        title="Удалить поле?"
        description="Значения этого поля в VPS сохранятся в данных, но перестанут отображаться."
        confirmLabel="Удалить"
        destructive
        onConfirm={onRemove}
      />
    </div>
  )
}

export function CustomFieldsEditor({ control, setValue, errors }: CustomFieldsEditorProps) {
  const { fields, append, remove, move } = useFieldArray({
    control,
    name: 'customFields',
  })
  const manualKeysRef = useRef<Set<number>>(new Set())
  const [rowIds, setRowIds] = useState<string[]>([])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const ids = fields.map((f, i) => rowIds[i] ?? f.id)
    const oldIndex = ids.indexOf(String(active.id))
    const newIndex = ids.indexOf(String(over.id))
    if (oldIndex < 0 || newIndex < 0) return
    move(oldIndex, newIndex)
    setRowIds((prev) => arrayMove(prev.length ? prev : ids, oldIndex, newIndex))
  }

  const handleAdd = () => {
    const n = fields.length + 1
    append({ key: `field_${n}`, label: '', type: 'text' })
  }

  if (fields.length === 0) {
    return (
      <EmptyState
        title="Кастомные поля не заданы"
        description="Добавьте поля для отображения в таблице VPS и в форме редактирования сервера"
        action={
          <Button type="button" variant="outline" onClick={handleAdd}>
            <PlusIcon data-icon="inline-start" />
            Добавить поле
          </Button>
        }
      />
    )
  }

  const ids = fields.map((f, i) => rowIds[i] ?? f.id)

  return (
    <div className="flex flex-col gap-3">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          {fields.map((field, index) => (
            <SortableFieldRow
              key={field.id}
              id={ids[index] ?? field.id}
              index={index}
              control={control}
              setValue={setValue}
              errors={errors}
              onRemove={() => remove(index)}
              manualKeysRef={manualKeysRef}
            />
          ))}
        </SortableContext>
      </DndContext>
      <Button type="button" variant="outline" className="w-fit" onClick={handleAdd}>
        <PlusIcon data-icon="inline-start" />
        Добавить поле
      </Button>
    </div>
  )
}
