import {
  DownloadIcon,
  ExpandIcon,
  LockIcon,
  LockOpenIcon,
  MaximizeIcon,
  MinusIcon,
  PlusIcon,
} from 'lucide-react'
import { Button } from '@cfdm/ui/components/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@cfdm/ui/components/tooltip'
import { cn } from '@cfdm/ui/lib/utils'

interface TopologyToolbarProps {
  zoomPercent: number
  locked: boolean
  className?: string
  onZoomIn: () => void
  onZoomOut: () => void
  onFitView: () => void
  onToggleLock: () => void
  onFullscreen: () => void
  onExport: () => void
}

export function TopologyToolbar({
  zoomPercent,
  locked,
  className,
  onZoomIn,
  onZoomOut,
  onFitView,
  onToggleLock,
  onFullscreen,
  onExport,
}: TopologyToolbarProps) {
  return (
    <TooltipProvider>
      <div
        className={cn(
          'flex items-center gap-0.5 rounded-full border border-border bg-background/95 px-1.5 py-1 shadow-sm backdrop-blur',
          className,
        )}
      >
        <Tooltip>
          <TooltipTrigger
            render={
              <Button type="button" variant="ghost" size="icon-sm" onClick={onZoomOut} aria-label="Уменьшить" />
            }
          >
            <MinusIcon />
          </TooltipTrigger>
          <TooltipContent>Уменьшить</TooltipContent>
        </Tooltip>
        <span className="min-w-10 px-1 text-center text-xs tabular-nums text-muted-foreground">
          {zoomPercent}%
        </span>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button type="button" variant="ghost" size="icon-sm" onClick={onZoomIn} aria-label="Увеличить" />
            }
          >
            <PlusIcon />
          </TooltipTrigger>
          <TooltipContent>Увеличить</TooltipContent>
        </Tooltip>
        <div className="mx-1 h-4 w-px bg-border" />
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={onToggleLock}
                aria-label={locked ? 'Разблокировать' : 'Заблокировать'}
              />
            }
          >
            {locked ? <LockIcon /> : <LockOpenIcon />}
          </TooltipTrigger>
          <TooltipContent>{locked ? 'Разблокировать' : 'Заблокировать'}</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button type="button" variant="ghost" size="icon-sm" onClick={onFitView} aria-label="Вписать" />
            }
          >
            <MaximizeIcon />
          </TooltipTrigger>
          <TooltipContent>Вписать в экран</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button type="button" variant="ghost" size="icon-sm" onClick={onExport} aria-label="Экспорт" />
            }
          >
            <DownloadIcon />
          </TooltipTrigger>
          <TooltipContent>Экспорт PNG</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={onFullscreen}
                aria-label="Полный экран"
              />
            }
          >
            <ExpandIcon />
          </TooltipTrigger>
          <TooltipContent>Полный экран</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  )
}
