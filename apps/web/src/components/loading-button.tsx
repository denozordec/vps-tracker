import { Button } from '@cfdm/ui/components/button'
import { Loader2Icon } from 'lucide-react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'

type LoadingButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  loading?: boolean
  variant?: 'default' | 'outline' | 'secondary' | 'ghost' | 'destructive' | 'link'
  size?: 'default' | 'xs' | 'sm' | 'lg' | 'icon' | 'icon-xs' | 'icon-sm' | 'icon-lg'
  children: ReactNode
}

export function LoadingButton({ loading, disabled, children, ...props }: LoadingButtonProps) {
  return (
    <Button disabled={disabled || loading} {...props}>
      {loading ? <Loader2Icon className="animate-spin" data-icon="inline-start" /> : null}
      {children}
    </Button>
  )
}
