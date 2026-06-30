import { ExternalLinkIcon } from 'lucide-react'
import { Link } from '@tanstack/react-router'

import { Badge } from '@/components/reui/badge'
import { useAppUrl } from '@/hooks/use-app-switcher'
import type { VpsDomain } from '@/types/entities'

interface VpsDomainsCellProps {
  domains: VpsDomain[]
}

export function VpsDomainsCell({ domains }: VpsDomainsCellProps) {
  const cfdmUrl = useAppUrl('cfdm')

  if (domains.length === 0) return <span className="text-muted-foreground">—</span>

  return (
    <div className="flex max-w-xs flex-col gap-1">
      {domains.slice(0, 3).map((d) => (
        <div key={d.id} className="flex flex-wrap items-center gap-1">
          <span className="truncate text-sm">{d.fqdn}</span>
          {d.matchStatus !== 'matched' ? (
            <Badge variant="warning" className="text-xs">
              {d.matchStatus === 'orphaned' ? 'orphan' : 'unmatched'}
            </Badge>
          ) : null}
          {cfdmUrl ? (
            <a
              href={`${cfdmUrl.replace(/\/$/, '')}/services`}
              className="text-muted-foreground hover:text-foreground"
              title={`Сервис ${d.serviceName} в CFDM`}
              target="_blank"
              rel="noreferrer"
            >
              <ExternalLinkIcon className="size-3.5" />
            </a>
          ) : null}
        </div>
      ))}
      {domains.length > 3 ? (
        <span className="text-xs text-muted-foreground">+{domains.length - 3}</span>
      ) : null}
    </div>
  )
}

export function UnmatchedDomainsBanner({ domains }: { domains: VpsDomain[] }) {
  const unmatched = domains.filter((d) => d.matchStatus === 'unmatched' || !d.vpsId)
  if (unmatched.length === 0) return null

  return (
    <div className="rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm">
      <p className="font-medium">Домены без привязки к VPS: {unmatched.length}</p>
      <ul className="mt-1 list-inside list-disc text-muted-foreground">
        {unmatched.slice(0, 5).map((d) => (
          <li key={d.id}>
            {d.fqdn} ({d.serviceName})
          </li>
        ))}
      </ul>
      <Link to="/settings/integrations" className="mt-2 inline-block text-sm underline">
        Настройки интеграции
      </Link>
    </div>
  )
}
