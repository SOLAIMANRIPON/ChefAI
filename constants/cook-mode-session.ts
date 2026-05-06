import AsyncStorage from '@react-native-async-storage/async-storage';

export const COOK_MODE_SESSION_KEY = 'chefai_cook_mode_session_v1';

export type CookModeSession = {
  dishName: string;
  recipe: string;
};

export async function saveCookModeSession(payload: CookModeSession): Promise<void> {
  await AsyncStorage.setItem(COOK_MODE_SESSION_KEY, JSON.stringify(payload));
}

export async function loadCookModeSession(): Promise<CookModeSession | null> {
  try {
    const raw = await AsyncStorage.getItem(COOK_MODE_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (
      parsed &&
      typeof parsed === 'object' &&
      typeof (parsed as CookModeSession).dishName === 'string' &&
      typeof (parsed as CookModeSession).recipe === 'string'
    ) {
      return { dishName: (parsed as CookModeSession).dishName, recipe: (parsed as CookModeSession).recipe };
    }
    return null;
  } catch {
    return null;
  }
}

export async function clearCookModeSession(): Promise<void> {
  await AsyncStorage.removeItem(COOK_MODE_SESSION_KEY);
}
