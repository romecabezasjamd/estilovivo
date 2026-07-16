import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  ReactNode,
} from 'react';
import {
  ThemeColor,
  applyCustomColorToDocument,
  applyThemeToDocument,
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
  syncFromUser: (user: any) => Promise<void>;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [presetTheme, setPresetThemeState] = useState<ThemeColor>('pink');
  const [customColor, setCustomColorState] = useState<string | null>(null);
  const [isCustom, setIsCustom] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const apiSynced = useRef(false);

  const syncFromUser = useCallback(async (user: any) => {
    if (user?.themePreset) {
      setPresetThemeState(user.themePreset as ThemeColor);
      applyThemeToDocument(user.themePreset as ThemeColor);
    }
    if (user?.customColor) {
      const normalized = applyCustomColorToDocument(user.customColor);
      if (normalized) setCustomColorState(normalized);
      setIsCustom(true);
    } else if (user?.themePreset) {
      setIsCustom(false);
      setCustomColorState(null);
    }
    apiSynced.current = true;
    setIsReady(true);
  }, []);

  useEffect(() => {
    let mounted = true;
    const handler = (e: Event) => {
      const user = (e as CustomEvent).detail;
      if (mounted && user) syncFromUser(user);
    };
    window.addEventListener('ev:user-loaded', handler as EventListener);

    const fallbackTimer = window.setTimeout(() => {
      if (mounted && !apiSynced.current) {
        loadSavedThemePreferences().then(prefs => {
          if (mounted) {
            setPresetThemeState(prefs.preset);
            setCustomColorState(prefs.customColor);
            setIsCustom(prefs.isCustom);
            setIsReady(true);
          }
        });
      }
    }, 3000);

    return () => {
      mounted = false;
      window.removeEventListener('ev:user-loaded', handler as EventListener);
      window.clearTimeout(fallbackTimer);
    };
  }, [syncFromUser]);

  const setPresetTheme = useCallback(async (theme: ThemeColor) => {
    await savePresetTheme(theme);
    setPresetThemeState(theme);
    setCustomColorState(null);
    setIsCustom(false);
    try { await api.updateProfile({ themePreset: theme, customColor: null } as any); } catch {}
  }, []);

  const setCustomColor = useCallback(async (hex: string) => {
    const saved = await saveCustomColor(hex);
    setCustomColorState(saved);
    setIsCustom(true);
    try { await api.updateProfile({ customColor: saved } as any); } catch {}
  }, []);

  const resetToDefault = useCallback(async () => {
    await resetThemeToDefault();
    setPresetThemeState('pink');
    setCustomColorState(null);
    setIsCustom(false);
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
        syncFromUser,
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
