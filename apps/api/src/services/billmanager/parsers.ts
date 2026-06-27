/**
 * BILLmanager API response parsers
 */

type BillmanagerElem = Record<string, unknown> | Array<Record<string, unknown>>

export function extractList(data: Record<string, unknown>, key: string): BillmanagerElem[] {
  if (Array.isArray(data.elem)) return data.elem as BillmanagerElem[]
  const dataNode = data.data as Record<string, unknown> | undefined
  if (dataNode?.elem) {
    return Array.isArray(dataNode.elem) ? (dataNode.elem as BillmanagerElem[]) : [dataNode.elem as BillmanagerElem]
  }
  const doc = (data.doc as Record<string, unknown>) || data
  let list = doc[key] as Record<string, unknown> | BillmanagerElem[] | undefined
  if (!list) return []
  if (Array.isArray(list)) return list
  if (list.elem) {
    return Array.isArray(list.elem) ? (list.elem as BillmanagerElem[]) : [list.elem as BillmanagerElem]
  }
  return []
}

export function elemToObject(elem: BillmanagerElem | null | undefined): Record<string, string> {
  if (!elem) return {}
  if (Array.isArray(elem)) {
    const obj: Record<string, string> = {}
    for (const e of elem) {
      const name = (e.$name || e.name) as string | undefined
      const val = e.$t ?? e.$
      if (name) {
        obj[name] =
          typeof val === 'object' && val !== null
            ? String((val as Record<string, unknown>).$t ?? (val as Record<string, unknown>).$ ?? JSON.stringify(val))
            : String(val ?? '')
      }
    }
    return obj
  }
  return Object.fromEntries(
    Object.entries(elem).map(([k, v]) => [k, v == null ? '' : String(v)]),
  )
}

export function parsePricelist(pricelist: unknown): {
  vcpu: number
  ramGb: number
  diskGb: number
  diskType: string
  virtualization: string
} {
  const s = String(pricelist || '')
  let vcpu = 0
  let ramGb = 0
  let diskGb = 0
  let diskType = 'NVMe'
  let virtualization = 'KVM'

  const cpuMatch = s.match(/(\d+)\s*(?:CPU|СPU)/i)
  if (cpuMatch) vcpu = parseInt(cpuMatch[1], 10) || 0

  const ramMbMatch = s.match(/(\d+)\s*MB\s*RAM/i)
  if (ramMbMatch) ramGb = Math.max(1, Math.round((parseInt(ramMbMatch[1], 10) || 0) / 1024))
  else {
    const ramGbMatch = s.match(/(\d+)\s*GB\s*RAM/i)
    if (ramGbMatch) ramGb = parseInt(ramGbMatch[1], 10) || 0
  }

  const diskMatch = s.match(/(\d+)\s*GB\s*(SSD|NVMe|HDD)/i)
  if (diskMatch) {
    diskGb = parseInt(diskMatch[1], 10) || 0
    diskType = diskMatch[2] || 'NVMe'
  }

  if (/\bKVM\b/i.test(s)) virtualization = 'KVM'
  else if (/\bOpenVZ\b/i.test(s)) virtualization = 'OpenVZ'
  else if (/\bLXC\b/i.test(s)) virtualization = 'LXC'

  return { vcpu, ramGb, diskGb, diskType, virtualization }
}

export function parseTariffDesc(desc: unknown): {
  name: string
  vcpu: number
  ramGb: number
  diskGb: number
  diskType: string
  virtualization: string
  channel: string
  location: string
  cpuModel: string
} {
  const s = String(desc || '')
  let name = ''
  let vcpu = 0
  let ramGb = 0
  let diskGb = 0
  let diskType = 'SSD'
  let virtualization = 'KVM'
  let channel = ''
  let location = ''
  let cpuModel = ''

  const firstLine = s.split(/\r?\n|<br\s*\/?>/i)[0]?.trim() || ''
  name = firstLine.replace(/<[^>]+>/g, '').trim()

  const cpuMatch = s.match(/Процессор:\s*(\d+)\s*(?:ядро|ядра|ядер)/i)
  if (cpuMatch) vcpu = parseInt(cpuMatch[1], 10) || 0

  const ramMbMatch = s.match(/Память:\s*(\d+)\s*MB/i)
  if (ramMbMatch) ramGb = Math.max(0.5, Math.round(((parseInt(ramMbMatch[1], 10) || 0) / 1024) * 10) / 10)
  else {
    const ramGbMatch = s.match(/Память:\s*(\d+)\s*GB/i)
    if (ramGbMatch) ramGb = parseInt(ramGbMatch[1], 10) || 0
  }

  const diskMatch = s.match(/Диск:\s*(\d+)\s*GB\s*(SSD|SAS|HDD|NVMe)/i)
  if (diskMatch) {
    diskGb = parseInt(diskMatch[1], 10) || 0
    diskType = diskMatch[2] || 'SSD'
  }

  const channelMatch = s.match(/Канал:\s*(\d+Mb\/s)/i)
  if (channelMatch) channel = channelMatch[1]

  if (/\bKVM\b/i.test(s)) virtualization = 'KVM'
  else if (/\bOpenVZ\b/i.test(s)) virtualization = 'OpenVZ'
  else if (/\bLXC\b/i.test(s)) virtualization = 'LXC'

  if (!channel) {
    const netMatch = s.match(/(?:Публичная сеть|Канал)[:\s]*\*?\*?(\d+)\s*Мбит/i)
    if (netMatch) channel = `${netMatch[1]} Мбит/с`
  }
  if (!location) {
    const locMatch = s.match(/Локация[:\s]*([^;]+)/i)
    if (locMatch) location = locMatch[1].replace(/<[^>]+>/g, '').trim()
  }
  if (!cpuModel) {
    const procMatch = s.match(/Процессор[:\s]*([^;]+?)(?:\s+до\s|$)/i)
    if (procMatch) cpuModel = procMatch[1].replace(/<[^>]+>/g, '').trim()
  }
  if (!diskType || diskType === 'SSD') {
    if (/\bNVMe\b/i.test(s)) diskType = 'NVMe'
    else if (/\bSAS\b/i.test(s)) diskType = 'SAS'
    else if (/\bHDD\b/i.test(s)) diskType = 'HDD'
    else if (/\bSSD\b/i.test(s)) diskType = 'SSD'
  }

  return { name, vcpu, ramGb, diskGb, diskType, virtualization, channel, location, cpuModel }
}

export function parseDatacenterName(dcName: unknown): { country: string; location: string } {
  const s = String(dcName || '').trim()
  if (!s) return { country: '', location: '' }

  const COUNTRY_CODE_MAP: Record<string, string> = {
    DE: 'Германия',
    FI: 'Финляндия',
    RU: 'Россия',
    FR: 'Франция',
    GB: 'Великобритания',
    NL: 'Нидерланды',
    US: 'США',
    SE: 'Швеция',
    NO: 'Норвегия',
    BE: 'Бельгия',
    CH: 'Швейцария',
    CZ: 'Чехия',
    CA: 'Канада',
    LV: 'Латвия',
    LT: 'Литва',
    EE: 'Эстония',
    PL: 'Польша',
    IT: 'Италия',
    DK: 'Дания',
    AU: 'Австралия',
    ES: 'Испания',
    SG: 'Сингапур',
  }

  const codeMatch = s.match(/\[([A-Z]{2})\]\s*([^|]+)/)
  if (codeMatch) {
    const code = codeMatch[1]
    const loc = codeMatch[2].trim()
    return { country: COUNTRY_CODE_MAP[code] || code, location: loc }
  }

  const dcMatch = s.match(/(?:\d+\s+)?Датацентр\s+([^,]+),\s*(.+)/i)
  if (dcMatch) {
    return { country: dcMatch[1].trim(), location: dcMatch[2].trim() }
  }

  const commaMatch = s.match(/^([^,]+),\s*(.+)$/)
  if (commaMatch) {
    return { country: commaMatch[1].trim(), location: commaMatch[2].trim() }
  }

  const countryOnly = [
    'Россия', 'Чехия', 'Нидерланды', 'Франция', 'Великобритания', 'Германия',
    'Финляндия', 'Швеция', 'Норвегия', 'Бельгия', 'Швейцария', 'Канада',
    'Латвия', 'Литва', 'Эстония', 'Польша', 'Италия', 'Дания', 'Австралия',
    'Испания', 'Сингапур', 'США', 'Азия', 'Европа',
  ]
  for (const c of countryOnly) {
    if (s === c || s.startsWith(c + ',') || s.startsWith(c + ' ')) {
      const rest = s.slice(c.length).replace(/^[,\s]+/, '')
      return { country: c, location: rest }
    }
  }

  if (/ММТС|Adman|Москва/i.test(s)) {
    return { country: 'Россия', location: s }
  }
  if (/Европа/i.test(s)) {
    return { country: 'Европа', location: s.replace(/Европа\s*/i, '').trim() || s }
  }

  const pipeMatch = s.match(/^([^|]+)\s*\|/)
  if (pipeMatch) {
    const part = pipeMatch[1].trim()
    for (const c of countryOnly) {
      if (part.includes(c)) return { country: c, location: '' }
    }
    return { country: part, location: '' }
  }

  return { country: s, location: '' }
}

export function extractTariflist(data: Record<string, unknown>): BillmanagerElem[] {
  if (!data) return []
  const doc = data.doc as Record<string, unknown> | undefined
  const listNode = (data.list as Record<string, unknown>) ?? doc?.list ?? doc
  if (!listNode || typeof listNode !== 'object') return []

  let list = (listNode as Record<string, unknown>).tariflist
    ?? (listNode as Record<string, unknown>).tarifflist
    ?? (listNode as Record<string, unknown>).pricelist
  if (Array.isArray(list)) return list as BillmanagerElem[]

  const elems = (listNode as Record<string, unknown>).elem
  if (elems) return Array.isArray(elems) ? (elems as BillmanagerElem[]) : [elems as BillmanagerElem]

  return []
}
