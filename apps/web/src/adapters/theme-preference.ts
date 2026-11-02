import {
  parseThemePreference,
  DEFAULT_THEME_PREFERENCE,
  type ThemePreference
} from '@budget-planner/i18n';

export {
  COLOR_SCHEMES,
  type ColorMode,
  type ColorScheme,
  type ThemePreference
} from '@budget-planner/i18n';

const THEME_STORAGE_KEY = 'budget-planner-theme-preference';

export function loadThemePreference(): ThemePreference {
  const raw = localStorage.getItem(THEME_STORAGE_KEY);
  if (!raw) {
    return DEFAULT_THEME_PREFERENCE;
  }
  try {
    return parseThemePreference(JSON.parse(raw));
  } catch {
    return DEFAULT_THEME_PREFERENCE;
  }
}

export function saveThemePreference(preference: ThemePreference): void {
  localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(preference));
}

export function applyThemePreference(preference: ThemePreference): void {
  document.documentElement.dataset.colorScheme = preference.colorScheme;
  document.documentElement.dataset.colorMode = preference.colorMode;
}

export function initializeThemePreference(): void {
  applyThemePreference(loadThemePreference());
}
