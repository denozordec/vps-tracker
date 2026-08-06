import { toast } from 'sonner'

/** Copy text to clipboard and show a success toast. */
export async function copyText(value: string, successMessage = 'Скопировано'): Promise<boolean> {
  const text = value.trim()
  if (!text) return false
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
    } else {
      return false
    }
    toast.success(successMessage)
    return true
  } catch {
    toast.error('Не удалось скопировать')
    return false
  }
}
