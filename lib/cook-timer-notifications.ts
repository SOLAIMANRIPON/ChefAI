import Constants from 'expo-constants';
import { Platform } from 'react-native';

export const COOK_TIMER_CHANNEL_ID = 'cook-timer';

let androidChannelReady = false;

type NotificationsModule = typeof import('expo-notifications');

async function getNotificationsModule(): Promise<NotificationsModule | null> {
  if (Platform.OS === 'web') return null;
  if (Constants.appOwnership === 'expo') return null;
  try {
    return await import('expo-notifications');
  } catch {
    return null;
  }
}

/** Run once at app startup (native only). Shows banners/sound when a scheduled timer fires while app is foregrounded. */
export function configureCookNotificationHandler(): void {
  if (Platform.OS === 'web' || Constants.appOwnership === 'expo') return;
  void (async () => {
    const Notifications = await getNotificationsModule();
    if (!Notifications) return;
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        priority: Notifications.AndroidNotificationPriority.HIGH,
      }),
    });
  })();
}

async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android' || androidChannelReady) return;
  const Notifications = await getNotificationsModule();
  if (!Notifications) return;
  await Notifications.setNotificationChannelAsync(COOK_TIMER_CHANNEL_ID, {
    name: 'Cook timer',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 280, 160, 280],
    sound: 'default',
    enableLights: true,
    enableVibrate: true,
  });
  androidChannelReady = true;
}

/** Request OS permission and Android channel; returns whether scheduling is allowed. */
export async function ensureCookTimerNotifyPermission(): Promise<boolean> {
  if (Platform.OS === 'web' || Constants.appOwnership === 'expo') return false;
  const Notifications = await getNotificationsModule();
  if (!Notifications) return false;
  await ensureAndroidChannel();
  const existing = await Notifications.getPermissionsAsync();
  if (existing.status === 'granted') return true;
  const asked = await Notifications.requestPermissionsAsync();
  return asked.status === 'granted';
}

export async function cancelCookTimerNotification(id: string | null | undefined): Promise<void> {
  if (Platform.OS === 'web' || Constants.appOwnership === 'expo' || id == null || id === '') return;
  const Notifications = await getNotificationsModule();
  if (!Notifications) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(id);
  } catch {
    /* noop */
  }
}

export async function scheduleCookTimerNotification(params: {
  fireAtMs: number;
  dishName: string;
  stepLabel: string;
}): Promise<string | null> {
  if (Platform.OS === 'web' || Constants.appOwnership === 'expo') return null;
  const Notifications = await getNotificationsModule();
  if (!Notifications) return null;

  const granted = await ensureCookTimerNotifyPermission();
  if (!granted) return null;

  const delayMs = params.fireAtMs - Date.now();
  if (delayMs < 800) return null;

  const titleBase = `ChefAI · ${params.dishName.trim() || 'টাইমার'}`.slice(0, 80);
  const body =
    (params.stepLabel.trim() || 'রান্নার টাইমার শেষ হয়েছে।').slice(0, 180);

  try {
    const identifier = await Notifications.scheduleNotificationAsync({
      content: {
        title: titleBase,
        body,
        sound: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
        data: { type: 'cook_timer_done' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: new Date(params.fireAtMs),
        ...(Platform.OS === 'android' ? { channelId: COOK_TIMER_CHANNEL_ID } : {}),
      },
    });
    return identifier;
  } catch {
    return null;
  }
}
