import type { Filter } from '@/components/reui/filters'

export function getActiveFilters(filters: Filter[]) {
  return filters.filter((filter) => {
    const { values } = filter
    if (!values || values.length === 0) return false
    if (values.every((value) => typeof value === 'string' && value.trim() === '')) {
      return false
    }
    if (values.every((value) => value === null || value === undefined)) {
      return false
    }
    if (values.every((value) => Array.isArray(value) && value.length === 0)) {
      return false
    }
    return true
  })
}

export function applyFiltersToData<T>(
  data: T[],
  filters: Filter[],
  getFieldValue: (item: T, field: string) => unknown,
): T[] {
  const active = getActiveFilters(filters)
  let result = [...data]

  for (const filter of active) {
    const { field, operator, values } = filter
    result = result.filter((item) => {
      const raw = getFieldValue(item, field)
      const fieldValue = raw != null ? raw : ''

      switch (operator) {
        case 'is':
          return values.includes(fieldValue)
        case 'is_not':
          return !values.includes(fieldValue)
        case 'is_any_of':
          return values.some((value) => fieldValue === value)
        case 'is_not_any_of':
          return !values.some((value) => fieldValue === value)
        case 'contains': {
          const tokens = values
            .map((value) => String(value).trim())
            .filter(Boolean)
          if (tokens.length === 0) return true
          return tokens.some((token) =>
            String(fieldValue).toLowerCase().includes(token.toLowerCase()),
          )
        }
        case 'not_contains':
          return !values.some((value) =>
            String(fieldValue).toLowerCase().includes(String(value).toLowerCase()),
          )
        case 'starts_with':
          return values.some((value) =>
            String(fieldValue).toLowerCase().startsWith(String(value).toLowerCase()),
          )
        case 'ends_with':
          return values.some((value) =>
            String(fieldValue).toLowerCase().endsWith(String(value).toLowerCase()),
          )
        case 'empty':
          return fieldValue === '' || fieldValue == null
        case 'not_empty':
          return fieldValue !== '' && fieldValue != null
        default:
          return true
      }
    })
  }

  return result
}

export function renderSelectedCount(values: unknown[]) {
  if (values.length === 0) return 'Выберите…'
  if (values.length > 1) return `${values.length} выбрано`
  return null
}

export function renderSingleSelectedLabel(
  values: unknown[],
  options: { value: string; label: string }[],
) {
  const state = renderSelectedCount(values)
  if (state) return state
  const option = options.find((item) => item.value === values[0])
  return option?.label ?? String(values[0])
}
