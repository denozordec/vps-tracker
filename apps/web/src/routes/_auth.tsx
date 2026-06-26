import { Outlet, createFileRoute } from '@tanstack/react-router'
import { snapshotQueryOptions } from '@/queries/snapshot'

export const Route = createFileRoute('/_auth')({
  loader: ({ context: { queryClient } }) =>
    queryClient.ensureQueryData(snapshotQueryOptions()),
  component: AuthLayout,
})

function AuthLayout() {
  return <Outlet />
}
