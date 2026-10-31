export const COLOR_SCHEMES = [
  { id: 'indigo', label: 'Indigo' },
  { id: 'ocean', label: 'Ocean' },
  { id: 'forest', label: 'Forest' },
  { id: 'rose', label: 'Rose' }
] as const;

export type ColorScheme = (typeof COLOR_SCHEMES)[number]['id'];
export type ColorMode = 'light' | 'dark';

export interface ThemePreference {
  colorScheme: ColorScheme;
  colorMode: ColorMode;
}

const THEME_STORAGE_KEY = 'budget-planner-theme-preference';
const DEFAULT_THEME_PREFERENCE: ThemePreference = {
  colorScheme: 'indigo',
  colorMode: 'light'
};

function isColorScheme(value: unknown): value is ColorScheme {
  return COLOR_SCHEMES.some(({ id }) => id === value);
}

function isColorMode(value: unknown): value is ColorMode {
  return value === 'light' || value === 'dark';
}

export function loadThemePreference(): ThemePreference {
  const raw = localStorage.getItem(THEME_STORAGE_KEY);
  if (!raw) {
    return DEFAULT_THEME_PREFERENCE;
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'colorScheme' in parsed &&
      'colorMode' in parsed &&
      isColorScheme(parsed.colorScheme) &&
      isColorMode(parsed.colorMode)
    ) {
      return { colorScheme: parsed.colorScheme, colorMode: parsed.colorMode };
    }
  } catch {
    return DEFAULT_THEME_PREFERENCE;
  }

  return DEFAULT_THEME_PREFERENCE;
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
