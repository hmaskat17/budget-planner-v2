import {
  detectLocalePreference as detectFromLanguages,
  loadStoredLocalePreference,
  saveStoredLocalePreference,
  type LocalePreference
} from '@budget-planner/preferences';

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
  return loadStoredLocalePreference(localStorage, detectLocalePreference());
}

export function saveLocalePreference(preference: LocalePreference): void {
  saveStoredLocalePreference(localStorage, preference);
}

export function applyLocalePreference(preference: LocalePreference): void {
  document.documentElement.lang = preference.language;
}
