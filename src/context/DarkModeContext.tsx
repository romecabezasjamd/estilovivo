import React, { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react';
import { DarkModeSetting, DarkModePreferences, loadDarkModePreference, saveDarkModePreference, listenForSystemChanges, applyDarkMode } from '../utils/darkMode';

interface DarkModeContextValue {
  setting: DarkModeSetting;
  active: boolean;
  isReady: boolean;
  setDarkMode: (s: DarkModeSetting) => Promise<void>;
}

const DarkModeContext = createContext<DarkModeContextValue | null>(null);

export const DarkModeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [prefs, setPrefs] = useState<DarkModePreferences>({ setting: 'system', active: false });
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    loadDarkModePreference().then(p => { if (mounted) { setPrefs(p); setIsReady(true); } });
    return () => { mounted = false; };
  }, []);

    useEffect(() => {
      if (!isReady) return;
      const unsub = listenForSystemChanges((isDark) => {
        if (prefs.setting === 'system') {
          setPrefs(prev => ({ ...prev, active: isDark }));
          applyDarkMode(isDark);
        }
      });
      return unsub;
    }, [isReady, prefs.setting]);

  const setDarkMode = useCallback(async (setting: DarkModeSetting) => {
    const p = await saveDarkModePreference(setting);
    setPrefs(p);
  }, []);

  return (
    <DarkModeContext.Provider value={{ setting: prefs.setting, active: prefs.active, isReady, setDarkMode }}>
      {children}
    </DarkModeContext.Provider>
  );
};

export const useDarkMode = (): DarkModeContextValue => {
  const ctx = useContext(DarkModeContext);
  if (!ctx) throw new Error('useDarkMode debe usarse dentro de DarkModeProvider');
  return ctx;
};
