import { AlertCircleIcon, XIcon } from 'lucide-react'
import { Link } from '@tanstack/react-router'
import { Alert, AlertDescription, AlertTitle } from '@cfdm/ui/components/alert'
import { Button } from '@cfdm/ui/components/button'

const HEALTH_LABELS: Record<string, string> = {
  'no-rate': 'Нет ставки или валюты',
  'paid-overdue': 'Просрочена оплата (оценка)',
  'stale-sync': 'Нет успешного синка > 48 ч',
  'balance-mismatch': 'Баланс API и ledger расходятся',
}

interface HealthModeBannerProps {
  health: string
  exitTo: string
}

export function HealthModeBanner({ health, exitTo }: HealthModeBannerProps) {
  const title = HEALTH_LABELS[health] ?? 'Режим диагностики'
  return (
    <Alert variant="destructive">
      <AlertCircleIcon />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription className="flex flex-wrap items-center gap-2">
        <span>Показаны только записи с этой проблемой.</span>
        <Button variant="outline" size="sm" render={<Link to={exitTo} search={{}} />}>
          <XIcon data-icon="inline-start" />
          Выйти из режима
        </Button>
      </AlertDescription>
    </Alert>
  )
}
