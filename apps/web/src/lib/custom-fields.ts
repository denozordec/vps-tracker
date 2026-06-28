export interface CustomFieldDef {
  key: string
  label: string
  type?: 'text' | 'number' | 'bool'
}

export function parseCustomFieldDefs(raw: unknown): CustomFieldDef[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((item): item is Record<string, unknown> => item != null && typeof item === 'object')
    .map((item) => ({
      key: String(item.key ?? '').trim(),
      label: String(item.label ?? item.key ?? '').trim(),
      type: (item.type as CustomFieldDef['type']) ?? 'text',
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
