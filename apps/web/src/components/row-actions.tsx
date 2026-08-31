import { useState, type ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { MoreHorizontalIcon, PencilIcon, Trash2Icon } from 'lucide-react'

import { Button } from '@cfdm/ui/components/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@cfdm/ui/components/dropdown-menu'
import { cn } from '@cfdm/ui/lib/utils'

import { ConfirmDialog } from './confirm-dialog'

export interface RowActionExtra {
  label: string
  icon?: LucideIcon
  onSelect: () => void
  disabled?: boolean
}

interface RowActionsProps {
  onEdit?: () => void
  onDelete?: () => void
  editLabel?: string
  deleteTitle?: string
  deleteDescription?: ReactNode
  deleteLabel?: string
  extra?: RowActionExtra[]
  className?: string
}

/**
 * Data-grid row actions — outline ⋯ menu.
 * Preview: https://reui.io/preview/base/components/c-dropdown-menu-12
 * Docs: https://reui.io/docs/components/base/dropdown-menu
 */
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
  const [deleteOpen, setDeleteOpen] = useState(false)
  const extras = extra ?? []
  if (!onEdit && !onDelete && extras.length === 0) return null

  return (
    <div className={cn('flex justify-end', className)}>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button type="button" variant="outline" size="icon-sm" aria-label="Действия" />
          }
        >
          <MoreHorizontalIcon className="size-4" aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-40">
          {extras.map((item) => {
            const Icon = item.icon
            return (
              <DropdownMenuItem
                key={item.label}
                disabled={item.disabled}
                onClick={item.onSelect}
              >
                {Icon ? <Icon aria-hidden /> : null}
                {item.label}
              </DropdownMenuItem>
            )
          })}
          {onEdit ? (
            <DropdownMenuItem onClick={onEdit}>
              <PencilIcon aria-hidden />
              {editLabel}
            </DropdownMenuItem>
          ) : null}
          {onDelete ? (
            <DropdownMenuItem variant="destructive" onClick={() => setDeleteOpen(true)}>
              <Trash2Icon aria-hidden />
              {deleteLabel}
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
      {onDelete ? (
        <ConfirmDialog
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
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
