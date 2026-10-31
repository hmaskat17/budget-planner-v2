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
} from '../i18n/locales.ts';

export interface LocalePreference {
  language: Language;
  currency: CurrencyCode;
  numberLocale: NumberLocale;
}

const LOCALE_STORAGE_KEY = 'budget-planner-locale-preference';

function browserLanguages(): readonly string[] {
  if (typeof navigator === 'undefined') {
    return [];
  }
  return navigator.languages?.length ? navigator.languages : [navigator.language].filter(Boolean);
}

/** Defaults derived from the browser; fall back to English, EUR and Finnish number formatting. */
export function detectLocalePreference(languages: readonly string[] = browserLanguages()): LocalePreference {
  return {
    language: detectLanguage(languages),
    currency: detectCurrency(languages),
    numberLocale: detectNumberLocale(languages)
  };
}

/** Each stored field is validated on its own; invalid or missing fields use the detected default. */
export function loadLocalePreference(): LocalePreference {
  const defaults = detectLocalePreference();
  const raw = localStorage.getItem(LOCALE_STORAGE_KEY);
  if (!raw) {
    return defaults;
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) {
      return defaults;
    }
    const stored = parsed as Record<string, unknown>;
    return {
      language: isLanguage(stored.language) ? stored.language : defaults.language,
      currency: isCurrency(stored.currency) ? stored.currency : defaults.currency,
      numberLocale: isNumberLocale(stored.numberLocale) ? stored.numberLocale : defaults.numberLocale
    };
  } catch {
    return defaults;
  }
}

export function saveLocalePreference(preference: LocalePreference): void {
  localStorage.setItem(LOCALE_STORAGE_KEY, JSON.stringify(preference));
}

export function applyLocalePreference(preference: LocalePreference): void {
  document.documentElement.lang = preference.language;
}
