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

export const DEFAULT_THEME_PREFERENCE: ThemePreference = {
  colorScheme: 'indigo',
  colorMode: 'light'
};

export function isColorScheme(value: unknown): value is ColorScheme {
  return COLOR_SCHEMES.some(({ id }) => id === value);
}

export function isColorMode(value: unknown): value is ColorMode {
  return value === 'light' || value === 'dark';
}

/** Returns the default preference unless both fields are valid. */
export function parseThemePreference(raw: unknown): ThemePreference {
  if (
    typeof raw === 'object' &&
    raw !== null &&
    'colorScheme' in raw &&
    'colorMode' in raw &&
    isColorScheme(raw.colorScheme) &&
    isColorMode(raw.colorMode)
  ) {
    return { colorScheme: raw.colorScheme, colorMode: raw.colorMode };
  }
  return DEFAULT_THEME_PREFERENCE;
}
