import type { ReactNode } from 'react'
import { cn } from '@cfdm/ui/lib/utils'

export function PageShell({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('flex flex-col gap-4 md:gap-6', className)}>{children}</div>
}
