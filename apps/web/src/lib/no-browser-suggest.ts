import type { HTMLInputProps } from '@/types/dom'

export const noBrowserSuggestProps: HTMLInputProps = Object.freeze({
  autoComplete: 'off',
  'data-lpignore': 'true',
  'data-1p-ignore': 'true',
  'data-bwignore': 'true',
  'data-form-type': 'other',
} as HTMLInputProps)

export const passwordCredentialInputProps: HTMLInputProps = Object.freeze({
  autoComplete: 'new-password',
} as HTMLInputProps)
