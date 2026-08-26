/**
 * RouterOS `:serialize to=json` of `$arr->0 = $item` yields
 * `{"0": {...}, "1": {...}}` instead of a JSON array.
 * Numbers may also come as strings (`schemaVersion: "1"`).
 */
export function coerceRouterosIngestBody(body: unknown): unknown {
  let value: unknown = body
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value)
    } catch {
      return body
    }
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value

  const rec = { ...(value as Record<string, unknown>) }
  if (rec.schemaVersion === '1') rec.schemaVersion = 1
  rec.results = coerceIndexedObjectToArray(rec.results)
  return rec
}

function coerceIndexedObjectToArray(value: unknown): unknown {
  if (Array.isArray(value) || value == null || typeof value !== 'object') return value
  const obj = value as Record<string, unknown>
  const keys = Object.keys(obj)
  if (keys.length === 0) return value
  if (!keys.every((key) => /^\d+$/.test(key))) return value
  return keys.sort((a, b) => Number(a) - Number(b)).map((key) => obj[key])
}
