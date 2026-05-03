import i18n from '@/lib/i18n';
import type { AppLanguage } from '@/lib/i18n';
import AsyncStorage from '@react-native-async-storage/async-storage';

/** Legacy key — cleared so the app always uses English UI. */
const LEGACY_LANGUAGE_STORAGE_KEY = 'chefai_app_language_v1';

/** App UI is fixed to English (no language picker). */
export async function hydrateAppLanguage(): Promise<AppLanguage> {
  try {
    await AsyncStorage.removeItem(LEGACY_LANGUAGE_STORAGE_KEY);
  } catch {
    /* ignore */
  }
  await i18n.changeLanguage('en');
  return 'en';
}
