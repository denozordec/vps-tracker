import type { ReactNode } from 'react'
import { Tabs, TabsList, TabsTrigger } from '@cfdm/ui/components/tabs'
import { cn } from '@cfdm/ui/lib/utils'

export interface CountedLineTab {
  id: string
  label: string
  count?: number
}

interface CountedLineTabsProps {
  tabs: CountedLineTab[]
  value: string
  onValueChange: (value: string) => void
  className?: string
  listClassName?: string
  children?: ReactNode
}

/** Page line tabs with mono counts (design «VPS-Tracker» ptabs; c-tabs-2). */
export function CountedLineTabs({
  tabs,
  value,
  onValueChange,
  className,
  listClassName,
  children,
}: CountedLineTabsProps) {
  return (
    <Tabs value={value} onValueChange={onValueChange} className={className}>
      <TabsList variant="line" className={cn('gap-5', listClassName)}>
        {tabs.map((tab) => (
          <TabsTrigger
            key={tab.id}
            value={tab.id}
            className="text-muted-foreground hover:text-foreground h-auto gap-2 px-0 pb-3 after:bottom-0"
          >
            <span>{tab.label}</span>
            {tab.count !== undefined ? (
              <span className="text-muted-foreground font-mono text-xs tabular-nums">
                {tab.count}
              </span>
            ) : null}
          </TabsTrigger>
        ))}
      </TabsList>
      {children}
    </Tabs>
  )
}
