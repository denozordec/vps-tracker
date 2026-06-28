import { z } from 'zod'

export const customFieldTypeSchema = z.enum(['text', 'number', 'bool'])

export const customFieldDefSchema = z.object({
  key: z
    .string()
    .min(1, 'Ключ обязателен')
    .regex(/^[a-z][a-z0-9_]*$/, 'Ключ: латиница, цифры, _, начинается с буквы'),
  label: z.string().min(1, 'Название обязательно').max(80),
  type: customFieldTypeSchema.default('text'),
})

export const customFieldsSchema = z.array(customFieldDefSchema)

export type CustomFieldType = z.infer<typeof customFieldTypeSchema>
export type CustomFieldDef = z.infer<typeof customFieldDefSchema>

export function parseCustomFieldDefs(raw: unknown): CustomFieldDef[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((item): item is Record<string, unknown> => item != null && typeof item === 'object')
    .map((item) => ({
      key: String(item.key ?? '').trim(),
      label: String(item.label ?? item.key ?? '').trim(),
      type: (item.type as CustomFieldType) ?? 'text',
    }))
    .filter((f) => f.key.length > 0)
}

export function parseCustomData(raw: unknown): Record<string, string | number | boolean> {
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw) as unknown
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, string | number | boolean>
      }
    } catch {
      return {}
    }
  }
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, string | number | boolean>
  }
  return {}
}

export function slugifyCustomFieldKey(label: string): string {
  const translitMap: Record<string, string> = {
    а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z',
    и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r',
    с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch',
    ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
  }
  const lower = label.trim().toLowerCase()
  let slug = ''
  for (const ch of lower) {
    if (translitMap[ch] !== undefined) {
      slug += translitMap[ch]
    } else if (/[a-z0-9]/.test(ch)) {
      slug += ch
    } else if (/\s|[-_]/.test(ch)) {
      slug += '_'
    }
  }
  slug = slug.replace(/_+/g, '_').replace(/^_|_$/g, '')
  if (!slug) return 'field'
  if (!/^[a-z]/.test(slug)) slug = `field_${slug}`
  return slug.slice(0, 40)
}

export function formatCustomFieldValue(
  def: CustomFieldDef,
  value: string | number | boolean | undefined,
): string {
  if (value === undefined || value === null || value === '') return '—'
  if (def.type === 'bool') return value ? 'Да' : 'Нет'
  if (def.type === 'number') {
    const n = Number(value)
    return Number.isFinite(n) ? String(n) : '—'
  }
  return String(value)
}
