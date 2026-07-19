import { type ReactNode } from 'react'

import { cn } from '@cfdm/ui/lib/utils'
import {
  Frame,
  FrameDescription,
  FrameFooter,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from '@/components/reui/frame'

interface SettingsCardProps {
  title: string
  description?: string
  children: ReactNode
  footer?: ReactNode
  className?: string
  contentClassName?: string
  footerClassName?: string
  headerClassName?: string
}

/** Settings section Frame — preview https://reui.io/preview/base/settings-16 · https://reui.io/preview/base/settings-3 */
export function SettingsCard({
  title,
  description,
  children,
  footer,
  className,
  contentClassName,
  footerClassName,
  headerClassName,
}: SettingsCardProps) {
  return (
    <Frame dense spacing="sm" className={cn('w-full gap-0 p-0', className)}>
      <FramePanel className="flex flex-col gap-0 p-0">
        <FrameHeader
          className={cn('gap-0.5 border-b border-border/50 px-5 py-3', headerClassName)}
        >
          <FrameTitle>{title}</FrameTitle>
          {description ? <FrameDescription>{description}</FrameDescription> : null}
        </FrameHeader>

        <div className={cn('min-w-0', contentClassName)}>{children}</div>

        {footer ? (
          <FrameFooter
            className={cn(
              'justify-end gap-2 border-t border-border/50 px-5 py-3',
              footerClassName,
            )}
          >
            {footer}
          </FrameFooter>
        ) : null}
      </FramePanel>
    </Frame>
  )
}
