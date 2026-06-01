import { getSecureItem, removeSecureItem, setSecureItem } from './secureStorage';
import { deriveThemeFromPrimary, normalizeHex } from './colorUtils';
import type { ThemeColors } from './themeTypes';

export type { ThemeColor, ThemeColors } from './themeTypes';
export { THEMES, DEFAULT_THEME } from './themePresets';

import { THEMES, DEFAULT_THEME } from './themePresets';
import type { ThemeColor } from './themeTypes';

const CUSTOM_COLOR_KEY = 'estilovivo_custom_color';
const PRESET_STORAGE_KEY = 'estilovivo_theme';

export const applyThemeColorsToDocument = (colors: ThemeColors) => {
  const root = document.documentElement;
  root.style.setProperty('--color-primary', colors.primary);
  root.style.setProperty('--color-primary-light', colors.light);
  root.style.setProperty('--color-primary-dark', colors.dark);
  root.style.setProperty('--color-accent', colors.accent);
  root.style.setProperty('--color-secondary', colors.secondary);
};

/** Aplica paleta predefinida y persiste (local + borra color custom seguro). */
export const applyThemeToDocument = (themeName: ThemeColor) => {
  const theme = THEMES[themeName] || THEMES[DEFAULT_THEME];
  applyThemeColorsToDocument(theme);
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(PRESET_STORAGE_KEY, themeName);
  }
};

export const applyCustomColorToDocument = (hex: string) => {
  const normalized = normalizeHex(hex);
  if (!normalized) return null;
  const derived = deriveThemeFromPrimary(normalized);
  applyThemeColorsToDocument(derived);
  return normalized;
};

export const getSavedTheme = (): ThemeColor => {
  return (localStorage.getItem(PRESET_STORAGE_KEY) as ThemeColor) || DEFAULT_THEME;
};

export interface SavedThemePreferences {
  preset: ThemeColor;
  customColor: string | null;
  isCustom: boolean;
}

export const loadSavedThemePreferences = async (): Promise<SavedThemePreferences> => {
  const preset = getSavedTheme();
  let customColor: string | null = null;

  try {
    const secure = await getSecureItem(CUSTOM_COLOR_KEY);
    if (secure) {
      customColor = normalizeHex(secure);
    }
  } catch {
  }

  if (customColor) {
    applyCustomColorToDocument(customColor);
    return { preset, customColor, isCustom: true };
  }

  applyThemeToDocument(preset);
  return { preset, customColor: null, isCustom: false };
};

export const savePresetTheme = async (themeName: ThemeColor) => {
  applyThemeToDocument(themeName);
  await removeSecureItem(CUSTOM_COLOR_KEY);
};

export const saveCustomColor = async (hex: string): Promise<string | null> => {
  const normalized = applyCustomColorToDocument(hex);
  if (!normalized) return null;
  await setSecureItem(CUSTOM_COLOR_KEY, normalized);
  return normalized;
};

export const resetThemeToDefault = async () => {
  await removeSecureItem(CUSTOM_COLOR_KEY);
  applyThemeToDocument(DEFAULT_THEME);
};

/** @deprecated Usar applyThemeToDocument — mantiene compatibilidad */
export const applyTheme = (themeName: ThemeColor) => {
  applyThemeToDocument(themeName);
  removeSecureItem(CUSTOM_COLOR_KEY).catch(() => {});
};
