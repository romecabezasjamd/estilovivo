import React, { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { DarkModeSetting, DarkModePreferences, loadDarkModePreference, saveDarkModePreference, listenForSystemChanges, applyDarkMode } from '../utils/darkMode';
import { api } from '../../services/api';

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
  const apiSynced = useRef(false);

  useEffect(() => {
    let mounted = true;
    const handler = async (e: Event) => {
      const user = (e as CustomEvent).detail;
      if (!mounted || !user?.darkModeSetting) return;
      apiSynced.current = true;
      const p = await saveDarkModePreference(user.darkModeSetting as DarkModeSetting);
      if (mounted) { setPrefs(p); setIsReady(true); }
    };
    window.addEventListener('ev:user-loaded', handler as EventListener);

    const fallbackTimer = window.setTimeout(() => {
      if (mounted && !apiSynced.current) {
        loadDarkModePreference().then(p => { if (mounted) { setPrefs(p); setIsReady(true); } });
      }
    }, 3000);

    return () => {
      mounted = false;
      window.removeEventListener('ev:user-loaded', handler as EventListener);
      window.clearTimeout(fallbackTimer);
    };
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
    try { await api.updateUserPreferences({ darkModeSetting: setting }); } catch {}
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
