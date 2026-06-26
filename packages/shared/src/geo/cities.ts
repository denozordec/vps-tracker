/**
 * Стандартизированный справочник городов по странам.
 * Используется в фильтрах VPS и форме редактирования.
 * Не зависит от данных в БД vps-tracker — общедоступный статичный справочник.
 */

import { COUNTRY_BY_CODE, COUNTRIES, type CountryRef } from './countries.js'

export interface CityRef {
  /** ISO 3166-1 alpha-2 код страны */
  countryCode: string
  /** Русское название города */
  name: string
  /** Английское название города */
  nameEn: string
}

/**
 * Топ-города по странам (включая города с крупными дата-центрами).
 * Список намеренно ограничен — расширяется по мере необходимости.
 */
export const CITIES: readonly CityRef[] = [
  // Россия
  { countryCode: 'RU', name: 'Москва', nameEn: 'Moscow' },
  { countryCode: 'RU', name: 'Санкт-Петербург', nameEn: 'Saint Petersburg' },
  { countryCode: 'RU', name: 'Новосибирск', nameEn: 'Novosibirsk' },
  { countryCode: 'RU', name: 'Екатеринбург', nameEn: 'Yekaterinburg' },
  { countryCode: 'RU', name: 'Казань', nameEn: 'Kazan' },
  { countryCode: 'RU', name: 'Нижний Новгород', nameEn: 'Nizhny Novgorod' },
  { countryCode: 'RU', name: 'Самара', nameEn: 'Samara' },
  { countryCode: 'RU', name: 'Ростов-на-Дону', nameEn: 'Rostov-on-Don' },
  { countryCode: 'RU', name: 'Уфа', nameEn: 'Ufa' },
  { countryCode: 'RU', name: 'Краснодар', nameEn: 'Krasnodar' },
  { countryCode: 'RU', name: 'Сочи', nameEn: 'Sochi' },
  { countryCode: 'RU', name: 'Владивосток', nameEn: 'Vladivostok' },
  { countryCode: 'RU', name: 'Иркутск', nameEn: 'Irkutsk' },
  { countryCode: 'RU', name: 'Хабаровск', nameEn: 'Khabarovsk' },
  { countryCode: 'RU', name: 'Тюмень', nameEn: 'Tyumen' },
  // Нидерланды
  { countryCode: 'NL', name: 'Амстердам', nameEn: 'Amsterdam' },
  { countryCode: 'NL', name: 'Роттердам', nameEn: 'Rotterdam' },
  { countryCode: 'NL', name: 'Гаага', nameEn: 'The Hague' },
  // Германия
  { countryCode: 'DE', name: 'Франкфурт', nameEn: 'Frankfurt' },
  { countryCode: 'DE', name: 'Берлин', nameEn: 'Berlin' },
  { countryCode: 'DE', name: 'Мюнхен', nameEn: 'Munich' },
  { countryCode: 'DE', name: 'Гамбург', nameEn: 'Hamburg' },
  { countryCode: 'DE', name: 'Кёльн', nameEn: 'Cologne' },
  { countryCode: 'DE', name: 'Дюссельдорф', nameEn: 'Düsseldorf' },
  { countryCode: 'DE', name: 'Штутгарт', nameEn: 'Stuttgart' },
  // Финляндия
  { countryCode: 'FI', name: 'Хельсинки', nameEn: 'Helsinki' },
  { countryCode: 'FI', name: 'Эспоо', nameEn: 'Espoo' },
  { countryCode: 'FI', name: 'Тампере', nameEn: 'Tampere' },
  // Швеция
  { countryCode: 'SE', name: 'Стокгольм', nameEn: 'Stockholm' },
  { countryCode: 'SE', name: 'Гётеборг', nameEn: 'Gothenburg' },
  { countryCode: 'SE', name: 'Мальмё', nameEn: 'Malmö' },
  // Норвегия
  { countryCode: 'NO', name: 'Осло', nameEn: 'Oslo' },
  { countryCode: 'NO', name: 'Берген', nameEn: 'Bergen' },
  // Дания
  { countryCode: 'DK', name: 'Копенгаген', nameEn: 'Copenhagen' },
  { countryCode: 'DK', name: 'Орхус', nameEn: 'Aarhus' },
  // Великобритания
  { countryCode: 'GB', name: 'Лондон', nameEn: 'London' },
  { countryCode: 'GB', name: 'Манчестер', nameEn: 'Manchester' },
  { countryCode: 'GB', name: 'Глазго', nameEn: 'Glasgow' },
  { countryCode: 'GB', name: 'Кардифф', nameEn: 'Cardiff' },
  // Франция
  { countryCode: 'FR', name: 'Париж', nameEn: 'Paris' },
  { countryCode: 'FR', name: 'Марсель', nameEn: 'Marseille' },
  { countryCode: 'FR', name: 'Лион', nameEn: 'Lyon' },
  { countryCode: 'FR', name: 'Страсбург', nameEn: 'Strasbourg' },
  // Испания
  { countryCode: 'ES', name: 'Мадрид', nameEn: 'Madrid' },
  { countryCode: 'ES', name: 'Барселона', nameEn: 'Barcelona' },
  { countryCode: 'ES', name: 'Валенсия', nameEn: 'Valencia' },
  // Италия
  { countryCode: 'IT', name: 'Рим', nameEn: 'Rome' },
  { countryCode: 'IT', name: 'Милан', nameEn: 'Milan' },
  { countryCode: 'IT', name: 'Турин', nameEn: 'Turin' },
  // Чехия
  { countryCode: 'CZ', name: 'Прага', nameEn: 'Prague' },
  { countryCode: 'CZ', name: 'Брно', nameEn: 'Brno' },
  // Польша
  { countryCode: 'PL', name: 'Варшава', nameEn: 'Warsaw' },
  { countryCode: 'PL', name: 'Краков', nameEn: 'Kraków' },
  { countryCode: 'PL', name: 'Вроцлав', nameEn: 'Wrocław' },
  { countryCode: 'PL', name: 'Гданьск', nameEn: 'Gdańsk' },
  // Швейцария
  { countryCode: 'CH', name: 'Цюрих', nameEn: 'Zurich' },
  { countryCode: 'CH', name: 'Женева', nameEn: 'Geneva' },
  { countryCode: 'CH', name: 'Базель', nameEn: 'Basel' },
  // Бельгия
  { countryCode: 'BE', name: 'Брюссель', nameEn: 'Brussels' },
  { countryCode: 'BE', name: 'Антверпен', nameEn: 'Antwerp' },
  // Австрия
  { countryCode: 'AT', name: 'Вена', nameEn: 'Vienna' },
  { countryCode: 'AT', name: 'Грац', nameEn: 'Graz' },
  // Латвия
  { countryCode: 'LV', name: 'Рига', nameEn: 'Riga' },
  // Литва
  { countryCode: 'LT', name: 'Вильнюс', nameEn: 'Vilnius' },
  { countryCode: 'LT', name: 'Каунас', nameEn: 'Kaunas' },
  // Эстония
  { countryCode: 'EE', name: 'Таллин', nameEn: 'Tallinn' },
  // Украина
  { countryCode: 'UA', name: 'Киев', nameEn: 'Kyiv' },
  { countryCode: 'UA', name: 'Харьков', nameEn: 'Kharkiv' },
  { countryCode: 'UA', name: 'Одесса', nameEn: 'Odesa' },
  { countryCode: 'UA', name: 'Львов', nameEn: 'Lviv' },
  // Казахстан
  { countryCode: 'KZ', name: 'Алматы', nameEn: 'Almaty' },
  { countryCode: 'KZ', name: 'Астана', nameEn: 'Astana' },
  // Беларусь
  { countryCode: 'BY', name: 'Минск', nameEn: 'Minsk' },
  // США
  { countryCode: 'US', name: 'Нью-Йорк', nameEn: 'New York' },
  { countryCode: 'US', name: 'Лос-Анджелес', nameEn: 'Los Angeles' },
  { countryCode: 'US', name: 'Чикаго', nameEn: 'Chicago' },
  { countryCode: 'US', name: 'Хьюстон', nameEn: 'Houston' },
  { countryCode: 'US', name: 'Даллас', nameEn: 'Dallas' },
  { countryCode: 'US', name: 'Майами', nameEn: 'Miami' },
  { countryCode: 'US', name: 'Сиэтл', nameEn: 'Seattle' },
  { countryCode: 'US', name: 'Сан-Франциско', nameEn: 'San Francisco' },
  { countryCode: 'US', name: 'Вашингтон', nameEn: 'Washington' },
  { countryCode: 'US', name: 'Атланта', nameEn: 'Atlanta' },
  { countryCode: 'US', name: 'Денвер', nameEn: 'Denver' },
  // Канада
  { countryCode: 'CA', name: 'Торонто', nameEn: 'Toronto' },
  { countryCode: 'CA', name: 'Монреаль', nameEn: 'Montreal' },
  { countryCode: 'CA', name: 'Ванкувер', nameEn: 'Vancouver' },
  // Сингапур
  { countryCode: 'SG', name: 'Сингапур', nameEn: 'Singapore' },
  // Япония
  { countryCode: 'JP', name: 'Токио', nameEn: 'Tokyo' },
  { countryCode: 'JP', name: 'Осака', nameEn: 'Osaka' },
  // Южная Корея
  { countryCode: 'KR', name: 'Сеул', nameEn: 'Seoul' },
  // Китай
  { countryCode: 'CN', name: 'Пекин', nameEn: 'Beijing' },
  { countryCode: 'CN', name: 'Шанхай', nameEn: 'Shanghai' },
  { countryCode: 'CN', name: 'Гуанчжоу', nameEn: 'Guangzhou' },
  { countryCode: 'CN', name: 'Шэньчжэнь', nameEn: 'Shenzhen' },
  { countryCode: 'CN', name: 'Гонконг', nameEn: 'Hong Kong' },
  // Индия
  { countryCode: 'IN', name: 'Мумбаи', nameEn: 'Mumbai' },
  { countryCode: 'IN', name: 'Дели', nameEn: 'Delhi' },
  { countryCode: 'IN', name: 'Бангалор', nameEn: 'Bangalore' },
  { countryCode: 'IN', name: 'Ченнаи', nameEn: 'Chennai' },
  // ОАЭ
  { countryCode: 'AE', name: 'Дубай', nameEn: 'Dubai' },
  { countryCode: 'AE', name: 'Абу-Даби', nameEn: 'Abu Dhabi' },
  // Турция
  { countryCode: 'TR', name: 'Стамбул', nameEn: 'Istanbul' },
  { countryCode: 'TR', name: 'Анкара', nameEn: 'Ankara' },
  { countryCode: 'TR', name: 'Измир', nameEn: 'Izmir' },
  // Бразилия
  { countryCode: 'BR', name: 'Сан-Паулу', nameEn: 'São Paulo' },
  { countryCode: 'BR', name: 'Рио-де-Жанейро', nameEn: 'Rio de Janeiro' },
  // Австралия
  { countryCode: 'AU', name: 'Сидней', nameEn: 'Sydney' },
  { countryCode: 'AU', name: 'Мельбурн', nameEn: 'Melbourne' },
  // Болгария
  { countryCode: 'BG', name: 'София', nameEn: 'Sofia' },
  // Румыния
  { countryCode: 'RO', name: 'Бухарест', nameEn: 'Bucharest' },
  // Венгрия
  { countryCode: 'HU', name: 'Будапешт', nameEn: 'Budapest' },
  // Греция
  { countryCode: 'GR', name: 'Афины', nameEn: 'Athens' },
  // Португалия
  { countryCode: 'PT', name: 'Лиссабон', nameEn: 'Lisbon' },
  // Ирландия
  { countryCode: 'IE', name: 'Дублин', nameEn: 'Dublin' },
  // Израиль
  { countryCode: 'IL', name: 'Тель-Авив', nameEn: 'Tel Aviv' },
]

export interface CityOption extends CityRef {
  country: CountryRef
}

/** Список городов с привязкой к стране. */
export function listCities(countryCode?: string): CityOption[] {
  return CITIES.filter((c) => !countryCode || c.countryCode === countryCode).map((c) => ({
    ...c,
    country: COUNTRY_BY_CODE[c.countryCode],
  }))
}

/** Список стран, у которых есть города в справочнике. */
export function countriesWithCities(): CountryRef[] {
  const codes = new Set(CITIES.map((c) => c.countryCode))
  return COUNTRIES.filter((c) => codes.has(c.code))
}
