import { SectionCards } from './section-cards'
import { Skeleton } from '@cfdm/ui/components/skeleton'
import { Card, CardContent } from '@cfdm/ui/components/card'

export function SectionCardsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <SectionCards
      items={Array.from({ length: count }, (_, i) => ({
        icon: <Skeleton className="size-4 rounded-sm" key={`icon-${i}`} />,
        label: <Skeleton className="h-3 w-20" key={`label-${i}`} />,
        value: <Skeleton className="h-5 w-16" key={`value-${i}`} />,
      }))}
    />
  )
}

export function TableSkeleton({ rows = 6, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <Card className="gap-0">
      <CardContent className="p-0">
        <div className="flex flex-col">
          <div className="flex gap-2 border-b p-3">
            {Array.from({ length: cols }).map((_, i) => (
              <Skeleton className="h-4 flex-1" key={`h-${i}`} />
            ))}
          </div>
          {Array.from({ length: rows }).map((_, r) => (
            <div className="flex gap-2 border-b p-3" key={`r-${r}`}>
              {Array.from({ length: cols }).map((_, c) => (
                <Skeleton className="h-4 flex-1" key={`c-${r}-${c}`} />
              ))}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
