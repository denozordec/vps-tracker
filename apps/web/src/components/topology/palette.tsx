import {
  CircleIcon,
  DiamondIcon,
  FolderOpenIcon,
  MousePointer2Icon,
  SquareIcon,
  StickyNoteIcon,
  ServerIcon,
} from 'lucide-react'
import { Button } from '@cfdm/ui/components/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@cfdm/ui/components/tooltip'
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

const DND_TYPE = 'application/topology-palette'

export function topologyDnDType(): string {
  return DND_TYPE
}

export function parsePaletteDrag(dataTransfer: DataTransfer): PaletteItem | null {
  const raw = dataTransfer.getData(DND_TYPE)
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
  disabled?: boolean
}

export function TopologyPalette({ className, onPickVps, disabled }: TopologyPaletteProps) {
  return (
    <TooltipProvider>
      <div
        className={cn(
          'flex flex-col gap-1 rounded-lg border border-border bg-background/95 p-1.5 shadow-sm backdrop-blur',
          className,
        )}
      >
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="pointer-events-none opacity-60"
              aria-label="Выделение"
            />
          }
        >
          <MousePointer2Icon />
        </TooltipTrigger>
        <TooltipContent side="right">Выделение</TooltipContent>
      </Tooltip>
      {ITEMS.map(({ item, icon: Icon, title }) => (
        <Tooltip key={title}>
          <TooltipTrigger
            render={
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                disabled={disabled}
                draggable={!disabled && item.kind !== 'vps-picker'}
                onDragStart={(e) => {
                  if (item.kind === 'vps-picker') return
                  e.dataTransfer.setData(DND_TYPE, JSON.stringify(item))
                  e.dataTransfer.effectAllowed = 'move'
                }}
                onClick={() => {
                  if (item.kind === 'vps-picker') onPickVps()
                }}
                aria-label={title}
              />
            }
          >
            <Icon />
          </TooltipTrigger>
          <TooltipContent side="right">{title}</TooltipContent>
        </Tooltip>
      ))}
      </div>
    </TooltipProvider>
  )
}

export function shapeLabel(kind: ShapeKind): string {
  if (kind === 'ellipse') return 'Эллипс'
  if (kind === 'diamond') return 'Ромб'
  return 'Блок'
}
