import React, { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react';
import { DarkModeSetting, DarkModePreferences, applyDarkMode } from '../utils/darkMode';
import { api } from '../../services/api';

interface DarkModeContextValue {
  setting: DarkModeSetting;
  active: boolean;
  isReady: boolean;
  setDarkMode: (s: DarkModeSetting) => Promise<void>;
}

const DarkModeContext = createContext<DarkModeContextValue | null>(null);

function getSystemPref(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function resolveActive(setting: DarkModeSetting): boolean {
  const systemDark = getSystemPref();
  return setting === 'on' || (setting === 'system' && systemDark);
}

export const DarkModeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [prefs, setPrefs] = useState<DarkModePreferences>(() => {
    const active = resolveActive('off');
    return { setting: 'off', active };
  });
  const [isReady, setIsReady] = useState(false);

  // Apply system default on mount so dark mode works immediately
  useEffect(() => {
    applyDarkMode(resolveActive('off'));
  }, []);

  useEffect(() => {
    let mounted = true;
    const handler = async (e: Event) => {
      const user = (e as CustomEvent).detail;
      if (!mounted || !user?.darkModeSetting) return;
      const setting = user.darkModeSetting as DarkModeSetting;
      const active = resolveActive(setting);
      applyDarkMode(active);
      if (mounted) { setPrefs({ setting, active }); setIsReady(true); }
    };
    window.addEventListener('ev:user-loaded', handler as EventListener);

    return () => {
      mounted = false;
      window.removeEventListener('ev:user-loaded', handler as EventListener);
    };
  }, []);

  useEffect(() => {
    if (!isReady) return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => {
      if (prefs.setting === 'system') {
        const active = e.matches;
        applyDarkMode(active);
        setPrefs(prev => ({ ...prev, active }));
      }
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [isReady, prefs.setting]);

  const setDarkMode = useCallback(async (setting: DarkModeSetting) => {
    const active = resolveActive(setting);
    applyDarkMode(active);
    setPrefs({ setting, active });
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
