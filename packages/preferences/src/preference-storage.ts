import { parseLocalePreference, type LocalePreference } from './preference.ts';
import { DEFAULT_THEME_PREFERENCE, parseThemePreference, type ThemePreference } from './theme.ts';

/** Structurally compatible with localStorage and the core KeyValueStore. */
export interface PreferenceStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const LOCALE_STORAGE_KEY = 'budget-planner-locale-preference';
export const THEME_STORAGE_KEY = 'budget-planner-theme-preference';

function loadParsed<T>(store: PreferenceStore, key: string, parse: (raw: unknown) => T, fallback: T): T {
  const raw = store.getItem(key);
  if (!raw) {
    return fallback;
  }
  try {
    return parse(JSON.parse(raw));
  } catch {
    return fallback;
  }
}

export function loadStoredLocalePreference(store: PreferenceStore, defaults: LocalePreference): LocalePreference {
  return loadParsed(store, LOCALE_STORAGE_KEY, (raw) => parseLocalePreference(raw, defaults), defaults);
}

export function saveStoredLocalePreference(store: PreferenceStore, preference: LocalePreference): void {
  store.setItem(LOCALE_STORAGE_KEY, JSON.stringify(preference));
}

export function loadStoredThemePreference(store: PreferenceStore): ThemePreference {
  return loadParsed(store, THEME_STORAGE_KEY, parseThemePreference, DEFAULT_THEME_PREFERENCE);
}

export function saveStoredThemePreference(store: PreferenceStore, preference: ThemePreference): void {
  store.setItem(THEME_STORAGE_KEY, JSON.stringify(preference));
}
