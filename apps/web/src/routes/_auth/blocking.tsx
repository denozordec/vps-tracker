import { createFileRoute } from '@tanstack/react-router'

import { BlockingPage } from '@/components/censorcheck/blocking-page'
import { censorcheckCurrentQueryOptions } from '@/queries/censorcheck'

export const Route = createFileRoute('/_auth/blocking')({
  loader: ({ context: { queryClient } }) =>
    queryClient.ensureQueryData(censorcheckCurrentQueryOptions()),
  component: BlockingPage,
})
