export const LANGUAGES = [
  { id: 'en', label: 'English' },
  { id: 'fi', label: 'Suomi' },
  { id: 'sv', label: 'Svenska' }
] as const;

export type Language = (typeof LANGUAGES)[number]['id'];

export const DEFAULT_LANGUAGE: Language = 'en';
export const DEFAULT_CURRENCY = 'EUR';
export const DEFAULT_NUMBER_LOCALE = 'fi-FI';

/** Commonly used number formatting styles, identified by BCP 47 locale tag. */
export const NUMBER_LOCALES = [
  'fi-FI',
  'sv-SE',
  'nb-NO',
  'da-DK',
  'en-GB',
  'en-US',
  'de-DE',
  'fr-FR',
  'es-ES',
  'it-IT',
  'nl-NL',
  'pl-PL'
] as const;

export type NumberLocale = (typeof NUMBER_LOCALES)[number];

/** Commonly used ISO 4217 currencies offered in the currency picker. */
export const CURRENCIES = [
  'EUR',
  'USD',
  'GBP',
  'SEK',
  'NOK',
  'DKK',
  'CHF',
  'ISK',
  'PLN',
  'CZK',
  'HUF',
  'RON',
  'CAD',
  'AUD',
  'NZD',
  'JPY',
  'CNY',
  'HKD',
  'SGD',
  'KRW',
  'INR',
  'BRL',
  'MXN',
  'ZAR',
  'TRY'
] as const;

export type CurrencyCode = (typeof CURRENCIES)[number];

const REGION_CURRENCY: Record<string, CurrencyCode> = {
  AT: 'EUR', BE: 'EUR', BG: 'EUR', CY: 'EUR', DE: 'EUR', EE: 'EUR', ES: 'EUR', FI: 'EUR',
  FR: 'EUR', GR: 'EUR', HR: 'EUR', IE: 'EUR', IT: 'EUR', LT: 'EUR', LU: 'EUR', LV: 'EUR',
  MT: 'EUR', NL: 'EUR', PT: 'EUR', SI: 'EUR', SK: 'EUR',
  US: 'USD', GB: 'GBP', SE: 'SEK', NO: 'NOK', DK: 'DKK', CH: 'CHF', IS: 'ISK', PL: 'PLN',
  CZ: 'CZK', HU: 'HUF', RO: 'RON', CA: 'CAD', AU: 'AUD', NZ: 'NZD', JP: 'JPY', CN: 'CNY',
  HK: 'HKD', SG: 'SGD', KR: 'KRW', IN: 'INR', BR: 'BRL', MX: 'MXN', ZA: 'ZAR', TR: 'TRY'
};

export function isLanguage(value: unknown): value is Language {
  return LANGUAGES.some(({ id }) => id === value);
}

export function isCurrency(value: unknown): value is CurrencyCode {
  return typeof value === 'string' && (CURRENCIES as readonly string[]).includes(value);
}

export function isNumberLocale(value: unknown): value is NumberLocale {
  return typeof value === 'string' && (NUMBER_LOCALES as readonly string[]).includes(value);
}

function parseLocale(tag: string): Intl.Locale | undefined {
  try {
    return new Intl.Locale(tag).maximize();
  } catch {
    return undefined;
  }
}

/** First browser language whose base language is supported; otherwise English. */
export function detectLanguage(browserLanguages: readonly string[]): Language {
  for (const tag of browserLanguages) {
    const base = parseLocale(tag)?.language;
    if (isLanguage(base)) {
      return base;
    }
  }
  return DEFAULT_LANGUAGE;
}

/** Currency of the first browser language whose region has a known currency; otherwise EUR. */
export function detectCurrency(browserLanguages: readonly string[]): CurrencyCode {
  for (const tag of browserLanguages) {
    const region = parseLocale(tag)?.region;
    if (region && region in REGION_CURRENCY) {
      return REGION_CURRENCY[region];
    }
  }
  return DEFAULT_CURRENCY;
}

/** Closest supported number format to the browser languages; otherwise Finnish. */
export function detectNumberLocale(browserLanguages: readonly string[]): NumberLocale {
  for (const tag of browserLanguages) {
    if (isNumberLocale(tag)) {
      return tag;
    }
    const locale = parseLocale(tag);
    if (!locale) {
      continue;
    }
    const exact = `${locale.language}-${locale.region}`;
    if (isNumberLocale(exact)) {
      return exact;
    }
    const sameLanguage = NUMBER_LOCALES.find((candidate) => candidate.startsWith(`${locale.language}-`));
    if (sameLanguage) {
      return sameLanguage;
    }
  }
  return DEFAULT_NUMBER_LOCALE;
}

export function getCurrencyName(code: string, language: Language): string {
  try {
    return new Intl.DisplayNames([language], { type: 'currency' }).of(code) ?? code;
  } catch {
    return code;
  }
}

/** Matches by currency code first (exact, then prefix, then contains), then by localized name. */
export function searchCurrencies(query: string, language: Language): CurrencyCode[] {
  const needle = query.trim().toLowerCase();
  if (!needle) {
    return [...CURRENCIES];
  }

  const rank = (code: CurrencyCode): number => {
    const lowerCode = code.toLowerCase();
    if (lowerCode === needle) return 0;
    if (lowerCode.startsWith(needle)) return 1;
    if (lowerCode.includes(needle)) return 2;
    if (getCurrencyName(code, language).toLowerCase().includes(needle)) return 3;
    return -1;
  };

  return CURRENCIES.map((code) => ({ code, score: rank(code) }))
    .filter(({ score }) => score >= 0)
    .sort((a, b) => a.score - b.score)
    .map(({ code }) => code);
}
