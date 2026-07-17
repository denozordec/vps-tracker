import type { ReactNode } from 'react'
import {
  Frame,
  FrameDescription,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from '@/components/reui/frame'
import { cn } from '@cfdm/ui/lib/utils'

export interface DetailMetricCard {
  id: string
  icon: ReactNode
  label: string
  description: string
  footer?: ReactNode
}

interface DetailPanelProps {
  children: ReactNode
  className?: string
}

function DetailPanelRoot({ children, className }: DetailPanelProps) {
  return <div className={cn('flex flex-col gap-4 md:gap-6', className)}>{children}</div>
}

interface DetailPanelHeaderProps {
  title: string
  description?: string
  actions?: ReactNode
  children?: ReactNode
}

function DetailPanelHeader({
  title,
  description,
  actions,
  children,
}: DetailPanelHeaderProps) {
  return (
    <Frame dense spacing="sm" className="w-full">
      <FrameHeader className="flex-row items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-px">
          <FrameTitle>{title}</FrameTitle>
          {description ? (
            <FrameDescription>{description}</FrameDescription>
          ) : null}
        </div>
        {actions ? (
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            {actions}
          </div>
        ) : null}
      </FrameHeader>
      {children ? <FramePanel className="flex flex-col gap-4">{children}</FramePanel> : null}
    </Frame>
  )
}

function DetailPanelMetrics({ cards }: { cards: DetailMetricCard[] }) {
  return (
    <div className="@container w-full">
      <div className="grid gap-4 @2xl:grid-cols-3">
        {cards.map((card) => (
          <Frame key={card.id} spacing="sm">
            <FrameHeader className="px-1! py-1!">
              <div className="[&_svg]:text-muted-foreground flex items-center gap-2 [&_svg]:size-4">
                {card.icon}
                <span className="text-foreground text-sm font-medium">
                  {card.label}
                </span>
              </div>
            </FrameHeader>
            <FramePanel className="flex flex-col gap-2">
              <p className="text-muted-foreground text-xs leading-relaxed">
                {card.description}
              </p>
              {card.footer}
            </FramePanel>
          </Frame>
        ))}
      </div>
    </div>
  )
}

function DetailPanelSection({
  title,
  description,
  children,
}: {
  title?: string
  description?: string
  children: ReactNode
}) {
  return (
    <section className="flex flex-col gap-3">
      {title ? (
        <header className="px-1">
          <h2 className="text-sm font-semibold">{title}</h2>
          {description ? (
            <p className="text-muted-foreground text-sm">{description}</p>
          ) : null}
        </header>
      ) : null}
      {children}
    </section>
  )
}

export const DetailPanel = Object.assign(DetailPanelRoot, {
  Header: DetailPanelHeader,
  Metrics: DetailPanelMetrics,
  Section: DetailPanelSection,
})
