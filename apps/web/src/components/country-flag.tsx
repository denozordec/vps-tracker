import { cn } from '@cfdm/ui/lib/utils'
import { getCountryFlagUrl, resolveCountryCode } from '@/lib/format'

interface CountryFlagProps {
  code?: string
  country?: string
  className?: string
}

export function CountryFlag({ code, country, className }: CountryFlagProps) {
  const resolvedCode = code ?? resolveCountryCode(country)
  const url = getCountryFlagUrl(resolvedCode)
  if (!url) return null

  return (
    <img
      src={url}
      alt=""
      className={cn('size-4 shrink-0 rounded-full object-cover', className)}
    />
  )
}
