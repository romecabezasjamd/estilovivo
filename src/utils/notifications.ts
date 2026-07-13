import { FirebaseMessaging } from '@capacitor-firebase/messaging';
import { Capacitor } from '@capacitor/core';

const isNative = Capacitor.isNativePlatform();

export async function requestNotificationPermission() {
  if (!isNative) return false;
  try {
    const result = await FirebaseMessaging.requestPermissions();
    return result.receive === 'granted';
  } catch (e) {
    console.warn('Notification permission request failed:', e);
    return false;
  }
}

export async function registerForPushNotifications() {
  if (!isNative) return;
  try {
    const { token } = await FirebaseMessaging.getToken();
    if (token) {
      console.log('Push token:', token);
    }
  } catch (e) {
    console.warn('Push token registration failed:', e);
  }
}

export function setupNotificationListeners(
  onNotificationReceived?: (title: string, body: string) => void,
  onNotificationTapped?: (data: unknown) => void
) {
  if (!isNative) return;

  FirebaseMessaging.addListener('notificationReceived', (event) => {
    onNotificationReceived?.(
      event.notification?.title || '',
      event.notification?.body || ''
    );
  });

  FirebaseMessaging.addListener('notificationActionPerformed', (action) => {
    onNotificationTapped?.(action.notification?.data || {});
  });
}
