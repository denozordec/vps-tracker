import { AlertTriangleIcon } from 'lucide-react'
import { Alert, AlertAction, AlertDescription, AlertTitle } from '@cfdm/ui/components/alert'
import { Button } from '@cfdm/ui/components/button'

interface DashboardInventoryAlertProps {
  issuesCount: number
  onGoToIssues: () => void
}

export function DashboardInventoryAlert({ issuesCount, onGoToIssues }: DashboardInventoryAlertProps) {
  if (issuesCount <= 0) return null

  return (
    <Alert variant="destructive">
      <AlertTriangleIcon />
      <AlertTitle>Требуется внимание!</AlertTitle>
      <AlertDescription>
        Обнаружено {issuesCount} категорий проблем в инвентаре. Проверьте вкладку «Проблемы».
      </AlertDescription>
      <AlertAction>
        <Button variant="destructive" size="sm" onClick={onGoToIssues}>
          К проблемам
        </Button>
      </AlertAction>
    </Alert>
  )
}
