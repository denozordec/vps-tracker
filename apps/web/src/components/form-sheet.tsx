import type { ReactElement, ReactNode } from 'react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@cfdm/ui/components/sheet'
import { LoadingButton } from './loading-button'

interface FormSheetProps {
  trigger?: ReactElement | null
  title: string
  description?: string
  open?: boolean
  onOpenChange?: (open: boolean) => void
  onSubmit?: () => void
  submitLabel?: string
  submitting?: boolean
  submitDisabled?: boolean
  children: ReactNode
}

export function FormSheet({
  trigger,
  title,
  description,
  open,
  onOpenChange,
  onSubmit,
  submitLabel = 'Сохранить',
  submitting,
  submitDisabled,
  children,
}: FormSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {trigger ? <SheetTrigger render={trigger} /> : null}
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          {description ? <SheetDescription>{description}</SheetDescription> : null}
        </SheetHeader>
        <form
          className="flex flex-1 flex-col gap-4 overflow-y-auto p-4"
          onSubmit={(e) => {
            e.preventDefault()
            onSubmit?.()
          }}
        >
          {children}
          {onSubmit ? (
            <SheetFooter className="mt-auto pt-4">
              <LoadingButton type="submit" loading={submitting} disabled={submitDisabled}>
                {submitLabel}
              </LoadingButton>
            </SheetFooter>
          ) : null}
        </form>
      </SheetContent>
    </Sheet>
  )
}
