import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from 'react';
import {
  ThemeColor,
  loadSavedThemePreferences,
  resetThemeToDefault,
  saveCustomColor,
  savePresetTheme,
} from '../utils/theme';
import { api } from '../../services/api';

interface ThemeContextValue {
  presetTheme: ThemeColor;
  customColor: string | null;
  isCustom: boolean;
  isReady: boolean;
  setPresetTheme: (theme: ThemeColor) => Promise<void>;
  setCustomColor: (hex: string) => Promise<void>;
  resetToDefault: () => Promise<void>;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [presetTheme, setPresetThemeState] = useState<ThemeColor>('pink');
  const [customColor, setCustomColorState] = useState<string | null>(null);
  const [isCustom, setIsCustom] = useState(false);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const prefs = await loadSavedThemePreferences();
      if (!mounted) return;
      setPresetThemeState(prefs.preset);
      setCustomColorState(prefs.customColor);
      setIsCustom(prefs.isCustom);
      setIsReady(true);

      // Try to load theme from server (only if auth token exists)
      const token = localStorage.getItem('beyour_token');
      if (token) {
        try {
          const user = await api.getMe();
          if (!mounted) return;
          if (user.themePreset) {
            setPresetThemeState(user.themePreset as ThemeColor);
            await savePresetTheme(user.themePreset as ThemeColor);
          }
          if (user.customColor) {
            setCustomColorState(user.customColor);
            await saveCustomColor(user.customColor);
            setIsCustom(true);
          } else if (user.themePreset) {
            setIsCustom(false);
            setCustomColorState(null);
          }
        } catch {}
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // Sync theme from user data when it changes in localStorage
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === 'ev_sync_user' && e.newValue) {
        try {
          const { value: user } = JSON.parse(e.newValue);
          if (user?.themePreset) {
            setPresetThemeState(user.themePreset as ThemeColor);
            savePresetTheme(user.themePreset as ThemeColor);
          }
          if (user?.customColor) {
            setCustomColorState(user.customColor);
            saveCustomColor(user.customColor);
            setIsCustom(true);
          }
        } catch {}
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  const setPresetTheme = useCallback(async (theme: ThemeColor) => {
    await savePresetTheme(theme);
    setPresetThemeState(theme);
    setCustomColorState(null);
    setIsCustom(false);
    // Sync to server
    try { await api.updateProfile({ themePreset: theme, customColor: null } as any); } catch {}
  }, []);

  const setCustomColor = useCallback(async (hex: string) => {
    const saved = await saveCustomColor(hex);
    setCustomColorState(saved);
    setIsCustom(true);
    // Sync to server
    try { await api.updateProfile({ customColor: saved } as any); } catch {}
  }, []);

  const resetToDefault = useCallback(async () => {
    await resetThemeToDefault();
    setPresetThemeState('pink');
    setCustomColorState(null);
    setIsCustom(false);
    // Sync to server
    try { await api.updateProfile({ themePreset: 'pink', customColor: null } as any); } catch {}
  }, []);

  return (
    <ThemeContext.Provider
      value={{
        presetTheme,
        customColor,
        isCustom,
        isReady,
        setPresetTheme,
        setCustomColor,
        resetToDefault,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextValue => {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme debe usarse dentro de ThemeProvider');
  }
  return ctx;
};

export const useThemeOptional = (): ThemeContextValue | null => useContext(ThemeContext);
