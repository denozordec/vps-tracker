import { createContext, useContext, useEffect } from 'react'

/** Setter for the current page breadcrumb (detail routes: «VPS / 203.0.113.21»). */
export const PageCrumbContext = createContext<(title: string | null) => void>(() => {})

/** Detail pages call this; AppShell shows `section / title` while the page is mounted. */
export function usePageCrumb(title: string | null | undefined) {
  const setTitle = useContext(PageCrumbContext)
  useEffect(() => {
    setTitle(title || null)
    return () => setTitle(null)
  }, [setTitle, title])
}
