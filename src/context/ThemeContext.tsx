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
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const setPresetTheme = useCallback(async (theme: ThemeColor) => {
    await savePresetTheme(theme);
    setPresetThemeState(theme);
    setCustomColorState(null);
    setIsCustom(false);
  }, []);

  const setCustomColor = useCallback(async (hex: string) => {
    const saved = await saveCustomColor(hex);
    setCustomColorState(saved);
    setIsCustom(true);
  }, []);

  const resetToDefault = useCallback(async () => {
    await resetThemeToDefault();
    setPresetThemeState('pink');
    setCustomColorState(null);
    setIsCustom(false);
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
