import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import { Toaster } from '@cfdm/ui/components/sonner'

import '@cfdm/ui/globals.css'

import { queryClient } from '@/lib/queryClient'
import { createRouter } from '@/lib/router'
import { ThemeProvider } from '@/components/theme-provider'

const router = createRouter({ context: { queryClient } })

const rootEl = document.getElementById('root')
if (!rootEl) throw new Error('Root element #root not found')

createRoot(rootEl).render(
  <StrictMode>
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
        <Toaster richColors position="top-right" />
      </QueryClientProvider>
    </ThemeProvider>
  </StrictMode>,
)
