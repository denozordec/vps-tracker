import { cn } from '@cfdm/ui/lib/utils'

interface ProjectColorDotProps {
  color?: string | null
  className?: string
}

export function ProjectColorDot({ color, className }: ProjectColorDotProps) {
  if (!color) return null

  return (
    <span
      className={cn('inline-block size-2.5 shrink-0 rounded-full', className)}
      style={{ backgroundColor: color }}
      aria-hidden
    />
  )
}
