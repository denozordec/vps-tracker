/**
 * BILLmanager 6 API HTTP client
 * @see https://www.ispsystem.com/docs/b6c/developer-section/working-with-api/guide-to-ispsystem-software-api
 */

interface BillmanagerErrorResponse {
  error?: { msg?: string; $t?: string }
}

export async function billmanagerRequest(
  baseUrl: string,
  authinfo: string,
  func: string,
  params: Record<string, string | number | undefined | null> = {},
): Promise<Record<string, unknown>> {
  const url = new URL(baseUrl)
  url.searchParams.set('authinfo', authinfo)
  url.searchParams.set('out', 'bjson')
  url.searchParams.set('func', func)
  for (const [k, v] of Object.entries(params)) {
    if (v != null && v !== '') url.searchParams.set(k, String(v))
  }
  const res = await fetch(url.toString(), { method: 'GET' })
  if (!res.ok) {
    throw new Error(`BILLmanager API HTTP ${res.status}: ${res.statusText}`)
  }
  const data = (await res.json()) as BillmanagerErrorResponse & Record<string, unknown>
  if (data.error) {
    throw new Error(data.error.msg || data.error.$t || 'BILLmanager API error')
  }
  return data
}
