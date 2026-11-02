import {
  detectCurrency,
  detectLanguage,
  detectNumberLocale,
  isCurrency,
  isLanguage,
  isNumberLocale,
  type CurrencyCode,
  type Language,
  type NumberLocale
} from './locales.ts';

export interface LocalePreference {
  language: Language;
  currency: CurrencyCode;
  numberLocale: NumberLocale;
}

/** Defaults derived from the platform's language tags; fall back to English, EUR and Finnish number formatting. */
export function detectLocalePreference(languages: readonly string[]): LocalePreference {
  return {
    language: detectLanguage(languages),
    currency: detectCurrency(languages),
    numberLocale: detectNumberLocale(languages)
  };
}

/** Each field is validated on its own; invalid or missing fields use the given default. */
export function parseLocalePreference(raw: unknown, defaults: LocalePreference): LocalePreference {
  if (typeof raw !== 'object' || raw === null) {
    return defaults;
  }
  const stored = raw as Record<string, unknown>;
  return {
    language: isLanguage(stored.language) ? stored.language : defaults.language,
    currency: isCurrency(stored.currency) ? stored.currency : defaults.currency,
    numberLocale: isNumberLocale(stored.numberLocale) ? stored.numberLocale : defaults.numberLocale
  };
}
