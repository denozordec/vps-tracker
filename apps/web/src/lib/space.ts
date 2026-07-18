import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

const STORAGE_KEY = 'vps_space_id'
const SPACE_EVENT = 'vps-space-changed'

export type SpaceDto = {
  id: string
  name: string
  slug: string
  kind: string
  ownerUserId: string | null
  createdAt: string
  role?: string
}

export function getStoredSpaceId(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

export function setStoredSpaceId(id: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, id)
    window.dispatchEvent(new CustomEvent(SPACE_EVENT, { detail: id }))
  } catch {
    /* ignore */
  }
}

export function clearStoredSpaceId(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
    window.dispatchEvent(new CustomEvent(SPACE_EVENT, { detail: null }))
  } catch {
    /* ignore */
  }
}

type SpaceContextValue = {
  spaceId: string | null
  setSpaceId: (id: string) => void
}

const SpaceContext = createContext<SpaceContextValue | null>(null)

/** Provides reactive spaceId so switcher / snapshot / pages re-render on change. */
export function SpaceProvider({ children }: { children: ReactNode }) {
  const [spaceId, setSpaceIdState] = useState<string | null>(() =>
    getStoredSpaceId(),
  )

  const setSpaceId = useCallback((id: string) => {
    setStoredSpaceId(id)
    setSpaceIdState(id)
  }, [])

  const value = useMemo(
    () => ({ spaceId, setSpaceId }),
    [spaceId, setSpaceId],
  )

  return createElement(SpaceContext.Provider, { value }, children)
}

export function useSpaceId(): SpaceContextValue {
  const ctx = useContext(SpaceContext)
  if (!ctx) {
    throw new Error('useSpaceId must be used within SpaceProvider')
  }
  return ctx
}
