import type { ReactNode } from 'react'
import { PencilIcon, Trash2Icon } from 'lucide-react'
import { Button } from '@cfdm/ui/components/button'
import { ConfirmDialog } from './confirm-dialog'

interface RowActionsProps {
  onEdit?: () => void
  onDelete?: () => void
  editLabel?: string
  deleteTitle?: string
  deleteDescription?: ReactNode
  deleteLabel?: string
  extra?: ReactNode
  className?: string
}

export function RowActions({
  onEdit,
  onDelete,
  editLabel = 'Редактировать',
  deleteTitle = 'Удалить запись?',
  deleteDescription,
  deleteLabel = 'Удалить',
  extra,
  className,
}: RowActionsProps) {
  if (!onEdit && !onDelete && !extra) return null

  return (
    <div className={`flex justify-end gap-1 ${className ?? ''}`}>
      {extra}
      {onEdit ? (
        <Button variant="ghost" size="icon-sm" onClick={onEdit} aria-label={editLabel}>
          <PencilIcon />
        </Button>
      ) : null}
      {onDelete ? (
        <ConfirmDialog
          trigger={
            <Button variant="ghost" size="icon-sm" aria-label="Удалить">
              <Trash2Icon />
            </Button>
          }
          title={deleteTitle}
          description={deleteDescription}
          destructive
          confirmLabel={deleteLabel}
          onConfirm={onDelete}
        />
      ) : null}
    </div>
  )
}
