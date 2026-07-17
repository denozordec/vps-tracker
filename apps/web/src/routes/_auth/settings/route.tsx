import { createFileRoute } from '@tanstack/react-router'

import { snapshotQueryOptions } from '@/queries/snapshot'
import { SettingsShell } from '@/components/reui-kit'

export const Route = createFileRoute('/_auth/settings')({
  loader: ({ context: { queryClient } }) =>
    queryClient.ensureQueryData(snapshotQueryOptions()),
  component: SettingsLayout,
})

function SettingsLayout() {
  return <SettingsShell />
}
