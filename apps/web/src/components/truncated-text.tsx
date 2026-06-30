import type { ReactNode } from 'react'

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@cfdm/ui/components/tooltip'
import { cn } from '@cfdm/ui/lib/utils'

interface TruncatedTextProps {
  children: ReactNode
  className?: string
  as?: 'span' | 'p' | 'div'
  /** Явный текст подсказки, если children — не строка. */
  tooltip?: string
}

export function TruncatedText({ children, className, as: Tag = 'span', tooltip }: TruncatedTextProps) {
  const tip =
    tooltip ??
    (typeof children === 'string' || typeof children === 'number' ? String(children) : null)

  if (!tip) {
    return <Tag className={cn('truncate', className)}>{children}</Tag>
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger render={<Tag className={cn('truncate', className)} />}>{children}</TooltipTrigger>
        <TooltipContent>{tip}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
