import { getSecureItem, setSecureItem } from './secureStorage';

const DARK_MODE_KEY = 'estilovivo_dark_mode';

export type DarkModeSetting = 'system' | 'on' | 'off';

export interface DarkModePreferences {
  setting: DarkModeSetting;
  active: boolean;
}

function getSystemPref(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function applyDarkMode(active: boolean) {
  if (active) {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
}

export async function loadDarkModePreference(): Promise<DarkModePreferences> {
  let setting: DarkModeSetting = 'system';
  try {
    const stored = await getSecureItem(DARK_MODE_KEY);
    if (stored === 'on' || stored === 'off' || stored === 'system') {
      setting = stored;
    }
  } catch {}

  const systemDark = getSystemPref();
  const active = setting === 'on' || (setting === 'system' && systemDark);
  applyDarkMode(active);
  return { setting, active };
}

export async function saveDarkModePreference(setting: DarkModeSetting): Promise<DarkModePreferences> {
  await setSecureItem(DARK_MODE_KEY, setting);
  const systemDark = getSystemPref();
  const active = setting === 'on' || (setting === 'system' && systemDark);
  applyDarkMode(active);
  return { setting, active };
}

export function listenForSystemChanges(callback: (isDark: boolean) => void) {
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  const handler = (e: MediaQueryListEvent) => callback(e.matches);
  mq.addEventListener('change', handler);
  return () => mq.removeEventListener('change', handler);
}
