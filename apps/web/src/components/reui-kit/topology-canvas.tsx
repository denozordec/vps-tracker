import type { ReactNode } from 'react'
import {
  Frame,
  FrameDescription,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from '@/components/reui/frame'
import { cn } from '@cfdm/ui/lib/utils'

interface TopologyCanvasProps {
  title?: string
  description?: string
  headerActions?: ReactNode
  tabs?: ReactNode
  children: ReactNode
  className?: string
}

/** Frame shell for topology whiteboard. Preview surface: frame. */
export function TopologyCanvas({
  title = 'Схема инфраструктуры',
  description,
  headerActions,
  tabs,
  children,
  className,
}: TopologyCanvasProps) {
  return (
    <Frame dense spacing="sm" className={cn('flex min-h-0 flex-1 flex-col', className)}>
      <FrameHeader className="flex-row items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-px">
          <FrameTitle>{title}</FrameTitle>
          {description ? <FrameDescription>{description}</FrameDescription> : null}
        </div>
        {headerActions ? (
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            {headerActions}
          </div>
        ) : null}
      </FrameHeader>
      {tabs ? <div className="border-b border-border px-1 pb-2">{tabs}</div> : null}
      <FramePanel className="relative min-h-[560px] flex-1 overflow-hidden p-0!">
        {children}
      </FramePanel>
    </Frame>
  )
}
