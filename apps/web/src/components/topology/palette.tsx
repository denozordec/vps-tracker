import {
  CircleIcon,
  DiamondIcon,
  FolderOpenIcon,
  MousePointer2Icon,
  SquareIcon,
  StickyNoteIcon,
  ServerIcon,
} from 'lucide-react'
import { cn } from '@cfdm/ui/lib/utils'
import type { PaletteItem, ShapeKind } from './types'

const ITEMS: { item: PaletteItem; icon: typeof SquareIcon; title: string }[] = [
  {
    item: { kind: 'shape', shape: 'rect', label: 'Прямоугольник' },
    icon: SquareIcon,
    title: 'Прямоугольник',
  },
  {
    item: { kind: 'shape', shape: 'ellipse', label: 'Эллипс' },
    icon: CircleIcon,
    title: 'Эллипс',
  },
  {
    item: { kind: 'shape', shape: 'diamond', label: 'Ромб' },
    icon: DiamondIcon,
    title: 'Ромб',
  },
  {
    item: { kind: 'note', label: 'Заметка' },
    icon: StickyNoteIcon,
    title: 'Заметка',
  },
  {
    item: { kind: 'group', label: 'Группа' },
    icon: FolderOpenIcon,
    title: 'Группа',
  },
  {
    item: { kind: 'vps-picker', label: 'VPS' },
    icon: ServerIcon,
    title: 'Добавить VPS',
  },
]

/** MIME used by React Flow drag-and-drop examples */
export const TOPOLOGY_DND_MIME = 'application/reactflow'

export function parsePaletteDrag(dataTransfer: DataTransfer): PaletteItem | null {
  const raw =
    dataTransfer.getData(TOPOLOGY_DND_MIME) ||
    dataTransfer.getData('text/plain')
  if (!raw) return null
  try {
    return JSON.parse(raw) as PaletteItem
  } catch {
    return null
  }
}

interface TopologyPaletteProps {
  className?: string
  onPickVps: () => void
  onPlaceItem?: (item: PaletteItem) => void
  disabled?: boolean
}

export function TopologyPalette({
  className,
  onPickVps,
  onPlaceItem,
  disabled,
}: TopologyPaletteProps) {
  function handlePick(item: PaletteItem) {
    if (disabled) return
    if (item.kind === 'vps-picker') {
      onPickVps()
      return
    }
    onPlaceItem?.(item)
  }

  return (
    <div
      className={cn(
        'flex flex-col gap-1 rounded-lg border border-border bg-background/95 p-1.5 shadow-sm backdrop-blur',
        className,
      )}
    >
      <div
        className="flex size-7 items-center justify-center rounded-md opacity-50"
        title="Выделение (по умолчанию)"
        aria-hidden
      >
        <MousePointer2Icon className="size-4" />
      </div>
      {ITEMS.map(({ item, icon: Icon, title }) => {
        const canDrag = !disabled && item.kind !== 'vps-picker'
        return (
          <div
            key={title}
            role="button"
            tabIndex={disabled ? -1 : 0}
            aria-label={title}
            title={
              item.kind === 'vps-picker'
                ? title
                : `${title} — клик или перетащите на схему`
            }
            className={cn(
              'flex size-7 cursor-grab items-center justify-center rounded-md text-foreground',
              'hover:bg-muted active:cursor-grabbing',
              disabled && 'pointer-events-none opacity-50',
              item.kind === 'vps-picker' && 'cursor-pointer',
            )}
            draggable={canDrag}
            onDragStart={(e) => {
              if (!canDrag) {
                e.preventDefault()
                return
              }
              const payload = JSON.stringify(item)
              e.dataTransfer.setData(TOPOLOGY_DND_MIME, payload)
              e.dataTransfer.setData('text/plain', payload)
              e.dataTransfer.effectAllowed = 'move'
            }}
            onClick={() => handlePick(item)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                handlePick(item)
              }
            }}
          >
            <Icon className="size-4" />
          </div>
        )
      })}
    </div>
  )
}

export function shapeLabel(kind: ShapeKind): string {
  if (kind === 'ellipse') return 'Эллипс'
  if (kind === 'diamond') return 'Ромб'
  return 'Блок'
}
