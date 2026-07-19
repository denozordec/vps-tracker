/**
 * 4VPS datacenter location helpers
 * @see https://4vps.su/page/api — getDcList: dc_name + flag
 */

/** ISO 3166-1 alpha-2 (flag) → русское название страны */
export const FOURVPS_FLAG_COUNTRY: Record<string, string> = {
  AE: 'ОАЭ',
  AT: 'Австрия',
  AU: 'Австралия',
  BE: 'Бельгия',
  BG: 'Болгария',
  CA: 'Канада',
  CH: 'Швейцария',
  CZ: 'Чехия',
  DE: 'Германия',
  DK: 'Дания',
  EE: 'Эстония',
  ES: 'Испания',
  FI: 'Финляндия',
  FR: 'Франция',
  GB: 'Великобритания',
  HK: 'Гонконг',
  HU: 'Венгрия',
  IE: 'Ирландия',
  IL: 'Израиль',
  IT: 'Италия',
  JP: 'Япония',
  KZ: 'Казахстан',
  LT: 'Литва',
  LV: 'Латвия',
  MD: 'Молдова',
  NL: 'Нидерланды',
  NO: 'Норвегия',
  PL: 'Польша',
  PT: 'Португалия',
  RO: 'Румыния',
  RU: 'Россия',
  SE: 'Швеция',
  SG: 'Сингапур',
  TR: 'Турция',
  UA: 'Украина',
  UK: 'Великобритания',
  US: 'США',
}

/** English / short codes often used in dc_name / tname prefixes */
const NAME_COUNTRY_ALIASES: Record<string, string> = {
  UAE: 'ОАЭ',
  USA: 'США',
  UK: 'Великобритания',
  GB: 'Великобритания',
  NL: 'Нидерланды',
  DE: 'Германия',
  FR: 'Франция',
  FI: 'Финляндия',
  SE: 'Швеция',
  PL: 'Польша',
  CZ: 'Чехия',
  RU: 'Россия',
  AE: 'ОАЭ',
  CA: 'Канада',
  HK: 'Гонконг',
  SG: 'Сингапур',
  TR: 'Турция',
  KZ: 'Казахстан',
}

function countryFromFlag(flag: unknown): string {
  const code = String(flag || '')
    .trim()
    .toUpperCase()
  if (!code) return ''
  return FOURVPS_FLAG_COUNTRY[code] || NAME_COUNTRY_ALIASES[code] || ''
}

/** Strip trailing «ДЦ1» / «DC 2» labels (not a city). */
function stripDcOrdinal(s: string): string {
  return s.replace(/\s*(?:ДЦ|DC)\s*\d+\s*$/i, '').trim()
}

/**
 * Parse 4VPS dc_name + flag → country / city.
 * Examples:
 * - («ОАЭ ДЦ1», ae) → ОАЭ / ''
 * - («USA DC1», us) → США / ''
 * - («Нидерланды Амстердам», nl) → Нидерланды / Амстердам
 * - («Германия, Франкфурт», de) → Германия / Франкфурт
 */
export function parseFourVpsDcLocation(
  dcName: unknown,
  flag?: unknown,
): { country: string; city: string } {
  const raw = String(dcName || '').trim()
  const fromFlag = countryFromFlag(flag)

  if (!raw) return { country: fromFlag, city: '' }

  const comma = raw.match(/^([^,]+),\s*(.+)$/)
  if (comma) {
    const left = comma[1]!.trim()
    const right = stripDcOrdinal(comma[2]!.trim())
    const leftCountry =
      NAME_COUNTRY_ALIASES[left.toUpperCase()] ||
      FOURVPS_FLAG_COUNTRY[left.toUpperCase()] ||
      (fromFlag && left.toUpperCase() === String(flag).toUpperCase() ? fromFlag : left)
    return {
      country: fromFlag || leftCountry,
      city: right,
    }
  }

  const withoutOrdinal = stripDcOrdinal(raw)
  if (!withoutOrdinal) {
    return { country: fromFlag || raw, city: '' }
  }

  // Exact country / alias match for whole string (e.g. «ОАЭ», «USA»)
  const upper = withoutOrdinal.toUpperCase()
  if (NAME_COUNTRY_ALIASES[upper] || FOURVPS_FLAG_COUNTRY[upper]) {
    return {
      country: fromFlag || NAME_COUNTRY_ALIASES[upper] || FOURVPS_FLAG_COUNTRY[upper]!,
      city: '',
    }
  }

  // Country name at start (RU list + aliases), rest = city
  const countryNames = [
    ...Object.values(FOURVPS_FLAG_COUNTRY),
    ...Object.keys(NAME_COUNTRY_ALIASES),
  ].sort((a, b) => b.length - a.length)

  for (const name of countryNames) {
    const re = new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:\\s+|$)`, 'i')
    if (re.test(withoutOrdinal)) {
      const rest = withoutOrdinal.replace(re, '').trim()
      const country =
        fromFlag ||
        NAME_COUNTRY_ALIASES[name.toUpperCase()] ||
        FOURVPS_FLAG_COUNTRY[name.toUpperCase()] ||
        name
      return { country, city: rest }
    }
  }

  // Fallback: first token country-ish, rest city
  const parts = withoutOrdinal.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) {
    const first = parts[0]!
    const firstCountry =
      NAME_COUNTRY_ALIASES[first.toUpperCase()] ||
      FOURVPS_FLAG_COUNTRY[first.toUpperCase()] ||
      ''
    if (firstCountry || fromFlag) {
      return {
        country: fromFlag || firstCountry,
        city: parts.slice(1).join(' '),
      }
    }
  }

  return { country: fromFlag || withoutOrdinal, city: '' }
}

/** Country for tariffs when only flag is known. */
export function countryFromFourVpsFlag(flag: unknown): string {
  return countryFromFlag(flag)
}
