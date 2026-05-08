import AsyncStorage from '@react-native-async-storage/async-storage';

export const COOK_MODE_SESSION_KEY = 'chefai_cook_mode_session_v1';

export type CookModeSession = {
  dishName: string;
  recipe: string;
  language?: string;
  /**
   * Pre-split cooking steps from the structured backend response. When present,
   * Cook Mode uses these directly instead of heuristically parsing `recipe` —
   * which is what makes "no more new parsing bugs per recipe" possible.
   * Optional so legacy sessions written before the structured pipeline still load.
   */
  steps?: string[];
  /** Pre-split ingredient lines for the same reason. */
  ingredients?: string[];
};

function sanitizeStringArray(value: unknown, max = 80): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const out: string[] = [];
  for (const v of value) {
    if (typeof v !== 'string') continue;
    const t = v.trim();
    if (t) out.push(t);
    if (out.length >= max) break;
  }
  return out.length ? out : undefined;
}

export async function saveCookModeSession(payload: CookModeSession): Promise<void> {
  const cleaned: CookModeSession = {
    dishName: payload.dishName,
    recipe: payload.recipe,
    ...(payload.language ? { language: payload.language } : {}),
    ...(payload.steps && payload.steps.length ? { steps: payload.steps } : {}),
    ...(payload.ingredients && payload.ingredients.length
      ? { ingredients: payload.ingredients }
      : {}),
  };
  await AsyncStorage.setItem(COOK_MODE_SESSION_KEY, JSON.stringify(cleaned));
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
      const obj = parsed as CookModeSession & Record<string, unknown>;
      return {
        dishName: obj.dishName,
        recipe: obj.recipe,
        ...(typeof obj.language === 'string' ? { language: obj.language } : {}),
        ...(sanitizeStringArray(obj.steps) ? { steps: sanitizeStringArray(obj.steps) } : {}),
        ...(sanitizeStringArray(obj.ingredients)
          ? { ingredients: sanitizeStringArray(obj.ingredients) }
          : {}),
      };
    }
    return null;
  } catch {
    return null;
  }
}

export async function clearCookModeSession(): Promise<void> {
  await AsyncStorage.removeItem(COOK_MODE_SESSION_KEY);
}
