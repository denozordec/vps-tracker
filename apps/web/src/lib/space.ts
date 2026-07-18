const STORAGE_KEY = 'vps_space_id'

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
  } catch {
    /* ignore */
  }
}

export function clearStoredSpaceId(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* ignore */
  }
}
