export type DietPreference = 'none' | 'vegetarian' | 'vegan' | 'gluten_free';
export type SpiceLevel = 'mild' | 'medium' | 'hot';

export function normalizeDietPreference(value?: string | null): DietPreference {
  if (value === 'vegetarian' || value === 'vegan' || value === 'gluten_free') return value;
  return 'none';
}

export function normalizeSpiceLevel(value?: string | null): SpiceLevel {
  if (value === 'mild' || value === 'medium' || value === 'hot') return value;
  return 'medium';
}

/** Empty or invalid → no calorie cap */
export function parseMaxCaloriesParam(value?: string | null): number | null {
  if (value == null || String(value).trim() === '') return null;
  const n = Number.parseInt(String(value).replace(/\D/g, ''), 10);
  if (!Number.isFinite(n) || n < 1 || n > 8000) return null;
  return n;
}
