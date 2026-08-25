import { createFileRoute } from '@tanstack/react-router'

import { GeoPage } from '@/components/ipregion/geo-page'
import { ipregionCurrentQueryOptions } from '@/queries/ipregion'

export const Route = createFileRoute('/_auth/geo')({
  loader: ({ context: { queryClient } }) =>
    queryClient.ensureQueryData(ipregionCurrentQueryOptions()),
  component: GeoPage,
})
