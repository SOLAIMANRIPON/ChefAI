import {
  type AppLanguage,
  SUPPORTED_APP_LANGUAGES,
  default as i18n,
} from '@/lib/i18n';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Localization from 'expo-localization';

const STORAGE_KEY = 'chefai_app_language_v1';
/** Persisted when user taps “Use device language” — not a real UI locale code */
const FOLLOW_SYSTEM_SENTINEL = '__chefai_follow_system__';

export function normalizeAppLanguage(raw: string | undefined | null): AppLanguage {
  const code = (raw ?? 'en').toLowerCase().slice(0, 2);
  if ((SUPPORTED_APP_LANGUAGES as readonly string[]).includes(code)) {
    return code as AppLanguage;
  }
  return 'en';
}

export function systemAppLanguage(): AppLanguage {
  const locales = Localization.getLocales();
  const code = locales[0]?.languageCode;
  return normalizeAppLanguage(code);
}

/** Resolved locale for i18n: default is always English unless user chose otherwise or “follow device”. */
export async function resolveAppLanguage(): Promise<AppLanguage> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return 'en';
    if (raw === FOLLOW_SYSTEM_SENTINEL) return systemAppLanguage();
    return normalizeAppLanguage(raw);
  } catch {
    return 'en';
  }
}

export async function setStoredAppLanguage(lng: AppLanguage): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, lng);
}

/** Follow phone/tablet locale on each launch (maps to en/bn/hi via normalizeAppLanguage). */
export async function setFollowDeviceLanguage(): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, FOLLOW_SYSTEM_SENTINEL);
}

export async function hydrateAppLanguage(): Promise<AppLanguage> {
  const lng = await resolveAppLanguage();
  await i18n.changeLanguage(lng);
  return lng;
}
