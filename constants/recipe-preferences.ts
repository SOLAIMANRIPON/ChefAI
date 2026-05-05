export type DietPreference = 'none' | 'vegetarian' | 'vegan' | 'gluten_free';
export type SpiceLevel = 'mild' | 'medium' | 'hot';
export type DifficultyLevel = 'easy' | 'medium' | 'hard';

export function normalizeDietPreference(value?: string | null): DietPreference {
  if (value === 'vegetarian' || value === 'vegan' || value === 'gluten_free') return value;
  return 'none';
}

export function normalizeSpiceLevel(value?: string | null): SpiceLevel {
  if (value === 'mild' || value === 'medium' || value === 'hot') return value;
  return 'medium';
}

export function normalizeDifficultyLevel(value?: string | null): DifficultyLevel {
  if (value === 'easy' || value === 'medium' || value === 'hard') return value;
  return 'medium';
}

/** Empty or invalid → no calorie cap */
export function parseMaxCaloriesParam(value?: string | null): number | null {
  if (value == null || String(value).trim() === '') return null;
  const n = Number.parseInt(String(value).replace(/\D/g, ''), 10);
  if (!Number.isFinite(n) || n < 1 || n > 8000) return null;
  return n;
}

const DEFAULT_SERVINGS = 4;
const MAX_SERVINGS = 20;

/** Empty or invalid → default servings (4). Clamp to 1–20. */
export function parseServingsParam(value?: string | null): number {
  if (value == null || String(value).trim() === '') return DEFAULT_SERVINGS;
  const n = Number.parseInt(String(value).replace(/\D/g, ''), 10);
  if (!Number.isFinite(n) || n < 1) return DEFAULT_SERVINGS;
  return Math.min(n, MAX_SERVINGS);
}

export function parseCookTimeMinutesParam(value?: string | null): number | null {
  if (value == null || String(value).trim() === '') return null;
  const n = Number.parseInt(String(value).replace(/\D/g, ''), 10);
  if (!Number.isFinite(n) || n < 1 || n > 600) return null;
  return n;
}
