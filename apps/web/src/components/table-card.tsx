import type { ReactNode } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@cfdm/ui/components/card'
import { cn } from '@cfdm/ui/lib/utils'

interface TableCardProps {
  title?: ReactNode
  description?: ReactNode
  actions?: ReactNode
  children: ReactNode
  className?: string
  contentClassName?: string
}

export function TableCard({ title, description, actions, children, className, contentClassName }: TableCardProps) {
  return (
    <Card className={cn('gap-0', className)}>
      {(title || actions) && (
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <div className="space-y-1">
            {title ? <CardTitle>{title}</CardTitle> : null}
            {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
          </div>
          {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
        </CardHeader>
      )}
      <CardContent className={cn('p-0', contentClassName)}>{children}</CardContent>
    </Card>
  )
}
