import {
  loadStoredThemePreference,
  saveStoredThemePreference,
  type ThemePreference
} from '@budget-planner/preferences';

export {
  COLOR_SCHEMES,
  type ColorMode,
  type ColorScheme,
  type ThemePreference
} from '@budget-planner/preferences';

export function loadThemePreference(): ThemePreference {
  return loadStoredThemePreference(localStorage);
}

export function saveThemePreference(preference: ThemePreference): void {
  saveStoredThemePreference(localStorage, preference);
}

export function applyThemePreference(preference: ThemePreference): void {
  document.documentElement.dataset.colorScheme = preference.colorScheme;
  document.documentElement.dataset.colorMode = preference.colorMode;
}

export function initializeThemePreference(): void {
  applyThemePreference(loadThemePreference());
}
