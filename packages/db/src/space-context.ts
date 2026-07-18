import { AsyncLocalStorage } from 'node:async_hooks'

export const MAIN_SPACE_ID = 'space-main'

const storage = new AsyncLocalStorage<{ spaceId: string }>()

export function runWithSpace<T>(spaceId: string, fn: () => T): T {
  return storage.run({ spaceId }, fn)
}

export async function runWithSpaceAsync<T>(
  spaceId: string,
  fn: () => Promise<T>,
): Promise<T> {
  return storage.run({ spaceId }, fn)
}

export function getCurrentSpaceId(): string {
  return storage.getStore()?.spaceId ?? MAIN_SPACE_ID
}

export function settingsIdForSpace(spaceId: string): string {
  return spaceId === MAIN_SPACE_ID ? 'settings-main' : `settings-${spaceId}`
}
