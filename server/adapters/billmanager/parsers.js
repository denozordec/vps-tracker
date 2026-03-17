/**
 * BILLmanager API response parsers
 */

/**
 * Parse BILLmanager JSON list response.
 * bjson: { elem: [ {...}, {...} ] } или { data: { elem: [...] } }
 * xml/json: { doc: { vds: { elem: [...] } } }
 */
export function extractList(data, key) {
  if (Array.isArray(data.elem)) return data.elem
  if (data.data?.elem) return Array.isArray(data.data.elem) ? data.data.elem : [data.data.elem]
  const doc = data.doc || data
  let list = doc[key]
  if (!list) return []
  if (Array.isArray(list)) return list
  if (list.elem) {
    const elems = Array.isArray(list.elem) ? list.elem : [list.elem]
    return elems
  }
  return []
}

/**
 * Extract flat object from BILLmanager elem (can be array of { $name, $t } or already flat object)
 */
export function elemToObject(elem) {
  if (!elem) return {}
  if (Array.isArray(elem)) {
    const obj = {}
    for (const e of elem) {
      const name = e.$name || e.name
      const val = e.$t ?? e.$ ?? e
      if (name) obj[name] = typeof val === 'object' && val !== null ? (val.$t ?? val.$ ?? JSON.stringify(val)) : val
    }
    return obj
  }
  return typeof elem === 'object' ? elem : {}
}

/**
 * Parse pricelist string: "KVM SSD Start (1 CPU/768 MB RAM/7 GB SSD)"
 * @returns {{ vcpu: number, ramGb: number, diskGb: number, diskType: string, virtualization: string }}
 */
export function parsePricelist(pricelist) {
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

/**
 * Парсит описание тарифа из vds.order.pricelist (desc)
 * Поддерживает два формата: текстовый (Firstbyte) и HTML (Selectel и др.)
 * @param {string} desc - HTML или текстовое описание тарифа
 * @returns {{ name: string, vcpu: number, ramGb: number, diskGb: number, diskType: string, virtualization: string, channel: string, location: string, cpuModel: string }}
 */
export function parseTariffDesc(desc) {
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

  // Формат 1: "Процессор: 1 ядро", "Память: 1 GB", "Диск: 20 GB SSD", "Канал: 200Mb/s"
  const cpuMatch = s.match(/Процессор:\s*(\d+)\s*(?:ядро|ядра|ядер)/i)
  if (cpuMatch) vcpu = parseInt(cpuMatch[1], 10) || 0

  const ramMbMatch = s.match(/Память:\s*(\d+)\s*MB/i)
  if (ramMbMatch) ramGb = Math.max(0.5, Math.round((parseInt(ramMbMatch[1], 10) || 0) / 1024 * 10) / 10)
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

  // Формат 2 (HTML): "Публичная сеть: 250 Мбит/с", "Локация: Москва, Россия", "Процессор: Ryzen 7 5800X", "NVMe накопитель"
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

/**
 * Парсит название датацентра для извлечения страны и локации
 * @param {string} dcName - название ДЦ, напр. "1 Датацентр Россия, Москва", "[DE] Франкфурт", "Франция"
 * @returns {{ country: string, location: string }}
 */
export function parseDatacenterName(dcName) {
  const s = String(dcName || '').trim()
  if (!s) return { country: '', location: '' }

  const COUNTRY_CODE_MAP = {
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

  // "[DE] Франкфурт | AMD EPYC" -> country: DE/Германия, location: Франкфурт
  const codeMatch = s.match(/\[([A-Z]{2})\]\s*([^|]+)/)
  if (codeMatch) {
    const code = codeMatch[1]
    const loc = codeMatch[2].trim()
    return { country: COUNTRY_CODE_MAP[code] || code, location: loc }
  }

  // "N Датацентр Страна, Город" или "Датацентр Страна, Город"
  const dcMatch = s.match(/(?:\d+\s+)?Датацентр\s+([^,]+),\s*(.+)/i)
  if (dcMatch) {
    return { country: dcMatch[1].trim(), location: dcMatch[2].trim() }
  }

  // "Страна, Город" (без слова Датацентр)
  const commaMatch = s.match(/^([^,]+),\s*(.+)$/)
  if (commaMatch) {
    return { country: commaMatch[1].trim(), location: commaMatch[2].trim() }
  }

  // Только страна: "Франция", "Россия", "Германия", "Чехия" и т.д.
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

  // "ММТС-9", "Adman", "Европа DC1", "Москва DC3" — по ключевым словам
  if (/ММТС|Adman|Москва/i.test(s)) {
    return { country: 'Россия', location: s }
  }
  if (/Европа/i.test(s)) {
    return { country: 'Европа', location: s.replace(/Европа\s*/i, '').trim() || s }
  }

  // "США | Ryzen 9 9950X" — страна до |
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

/**
 * Извлечь tariflist из ответа vds.order (поддержка разных форматов BILLmanager)
 * @param {object} data - сырой ответ API
 * @returns {Array}
 */
export function extractTariflist(data) {
  if (!data) return []
  const listNode = data.list ?? data.doc?.list ?? data.doc
  if (!listNode) return []

  // tariflist / tarifflist / pricelist — разные варианты названия
  let list = listNode.tariflist ?? listNode.tarifflist ?? listNode.pricelist
  if (Array.isArray(list)) return list

  // elem-формат (как в vds, payment)
  const elems = listNode.elem
  if (elems) return Array.isArray(elems) ? elems : [elems]

  return []
}
