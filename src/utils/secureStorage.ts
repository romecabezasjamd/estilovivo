import { Capacitor, registerPlugin } from '@capacitor/core';

interface EncryptedStoragePlugin {
  getItem(options: { key: string }): Promise<{ value: string | null }>;
  setItem(options: { key: string; value: string }): Promise<void>;
  removeItem(options: { key: string }): Promise<void>;
  clear(): Promise<void>;
}

const EncryptedStorage = registerPlugin<EncryptedStoragePlugin>('EncryptedStorage', {
  web: () => import('./secureStorage.web').then(m => new m.SecureStorageWeb())
});

const STORAGE_PREFIX = 'secure:';
const formatKey = (key: string) => `${STORAGE_PREFIX}${key}`;

export const getSecureItem = async (key: string): Promise<string | null> => {
  const storageKey = formatKey(key);
  if (Capacitor.getPlatform() === 'web') {
    return localStorage.getItem(storageKey);
  }
  try {
    const result = await EncryptedStorage.getItem({ key: storageKey });
    return result.value || null;
  } catch (error) {
    console.warn('[SecureStorage] getItem failed', key, error);
    return localStorage.getItem(storageKey);
  }
};

export const setSecureItem = async (key: string, value: string): Promise<void> => {
  const storageKey = formatKey(key);
  if (Capacitor.getPlatform() === 'web') {
    localStorage.setItem(storageKey, value);
    return;
  }

  try {
    await EncryptedStorage.setItem({ key: storageKey, value });
  } catch (error) {
    console.warn('[SecureStorage] setItem failed', key, error);
    localStorage.setItem(storageKey, value);
  }
};

export const removeSecureItem = async (key: string): Promise<void> => {
  const storageKey = formatKey(key);
  if (Capacitor.getPlatform() === 'web') {
    localStorage.removeItem(storageKey);
    return;
  }

  try {
    await EncryptedStorage.removeItem({ key: storageKey });
  } catch (error) {
    console.warn('[SecureStorage] removeItem failed', key, error);
    localStorage.removeItem(storageKey);
  }
};

export const clearSecureStorage = async (): Promise<void> => {
  if (Capacitor.getPlatform() === 'web') {
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith(STORAGE_PREFIX)) {
        localStorage.removeItem(key);
      }
    });
    return;
  }

  try {
    await EncryptedStorage.clear();
  } catch (error) {
    console.warn('[SecureStorage] clear failed', error);
  }
};
