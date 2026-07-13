import { FirebaseAnalytics } from '@capacitor-firebase/analytics';
import { FirebaseCrashlytics } from '@capacitor-firebase/crashlytics';
import { Capacitor } from '@capacitor/core';

const isNative = Capacitor.isNativePlatform();

export const analytics = {
  async logEvent(name: string, params?: Record<string, unknown>) {
    if (!isNative) return;
    try {
      await FirebaseAnalytics.logEvent({ name, params: params as { [key: string]: any } });
    } catch (e) {
      console.warn('Analytics logEvent failed:', e);
    }
  },

  async setUserId(userId: string | null) {
    if (!isNative) return;
    try {
      await FirebaseAnalytics.setUserId({ userId: userId || '' });
    } catch (e) {
      console.warn('Analytics setUserId failed:', e);
    }
  },

  async setUserProperty(key: string, value: string | null) {
    if (!isNative) return;
    try {
      await FirebaseAnalytics.setUserProperty({ key, value });
    } catch (e) {
      console.warn('Analytics setUserProperty failed:', e);
    }
  },

  async setScreenName(screenName: string) {
    if (!isNative) return;
    try {
      await FirebaseAnalytics.setCurrentScreen({ screenName });
    } catch (e) {
      console.warn('Analytics setScreenName failed:', e);
    }
  },
};

export const crashlytics = {
  async log(message: string) {
    if (!isNative) return;
    try {
      await FirebaseCrashlytics.log({ message });
    } catch (e) {
      console.warn('Crashlytics log failed:', e);
    }
  },

  async setUserId(userId: string) {
    if (!isNative) return;
    try {
      await FirebaseCrashlytics.setUserId({ userId });
    } catch (e) {
      console.warn('Crashlytics setUserId failed:', e);
    }
  },

  async setCustomKey(key: string, value: string | number | boolean, type: 'string' | 'long' | 'double' | 'boolean' | 'int' | 'float' = 'string') {
    if (!isNative) return;
    try {
      await FirebaseCrashlytics.setCustomKey({ key, value, type });
    } catch (e) {
      console.warn('Crashlytics setCustomKey failed:', e);
    }
  },

  async recordError(error: Error) {
    if (!isNative) return;
    try {
      await FirebaseCrashlytics.recordException({
        message: error.message,
      });
    } catch (e) {
      console.warn('Crashlytics recordError failed:', e);
    }
  },
};
