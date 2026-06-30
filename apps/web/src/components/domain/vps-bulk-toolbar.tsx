import { ArchiveIcon, FolderKanbanIcon, PauseIcon, PlayIcon, Trash2Icon } from 'lucide-react'
import { Button } from '@cfdm/ui/components/button'
import { SelectField } from '@/components/select-field'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { useState } from 'react'
import { vpsStatusLabel } from '@/lib/format'

interface VpsBulkToolbarProps {
  selectedCount: number
  projectOptions: string[]
  onSetStatus: (status: 'active' | 'paused' | 'archived') => void
  onSetProject: (project: string) => void
  onDelete: () => void
  busy?: boolean
}

export function VpsBulkToolbar({
  selectedCount,
  projectOptions,
  onSetStatus,
  onSetProject,
  onDelete,
  busy,
}: VpsBulkToolbarProps) {
  const [projectValue, setProjectValue] = useState('')

  if (selectedCount === 0) return null

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2">
      <span className="text-sm font-medium tabular-nums">Выбрано: {selectedCount}</span>
      <Button variant="outline" size="sm" disabled={busy} onClick={() => onSetStatus('active')}>
        <PlayIcon data-icon="inline-start" />
        {vpsStatusLabel('active')}
      </Button>
      <Button variant="outline" size="sm" disabled={busy} onClick={() => onSetStatus('paused')}>
        <PauseIcon data-icon="inline-start" />
        {vpsStatusLabel('paused')}
      </Button>
      <Button variant="outline" size="sm" disabled={busy} onClick={() => onSetStatus('archived')}>
        <ArchiveIcon data-icon="inline-start" />
        {vpsStatusLabel('archived')}
      </Button>
      <div className="flex items-center gap-1">
        <SelectField
          placeholder="Проект…"
          aria-label="Проект для массового назначения"
          value={projectValue}
          onValueChange={(v) => setProjectValue(v ?? '')}
          options={projectOptions.map((p) => ({ value: p, label: p }))}
          triggerClassName="w-40"
        />
        <Button
          variant="outline"
          size="sm"
          disabled={busy || !projectValue}
          onClick={() => {
            onSetProject(projectValue)
            setProjectValue('')
          }}
        >
          <FolderKanbanIcon data-icon="inline-start" />
          Назначить
        </Button>
      </div>
      <ConfirmDialog
        trigger={
          <Button variant="destructive" size="sm" disabled={busy}>
            <Trash2Icon data-icon="inline-start" />
            Удалить
          </Button>
        }
        title={`Удалить ${selectedCount} VPS?`}
        description="Записи будут удалены безвозвратно."
        confirmLabel="Удалить"
        destructive
        onConfirm={onDelete}
      />
    </div>
  )
}
