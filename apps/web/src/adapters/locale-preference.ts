import {
  detectLocalePreference as detectFromLanguages,
  parseLocalePreference,
  type LocalePreference
} from '@budget-planner/i18n';

const LOCALE_STORAGE_KEY = 'budget-planner-locale-preference';

function browserLanguages(): readonly string[] {
  if (typeof navigator === 'undefined') {
    return [];
  }
  return navigator.languages?.length ? navigator.languages : [navigator.language].filter(Boolean);
}

export function detectLocalePreference(): LocalePreference {
  return detectFromLanguages(browserLanguages());
}

export function loadLocalePreference(): LocalePreference {
  const defaults = detectLocalePreference();
  const raw = localStorage.getItem(LOCALE_STORAGE_KEY);
  if (!raw) {
    return defaults;
  }
  try {
    return parseLocalePreference(JSON.parse(raw), defaults);
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
