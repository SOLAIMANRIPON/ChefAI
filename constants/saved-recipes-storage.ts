import AsyncStorage from '@react-native-async-storage/async-storage';

/** Legacy single-blob key — exceeds Android CursorWindow */
export const LEGACY_SAVED_RECIPES_KEY = 'chefai_saved_recipes_v1';

const INDEX_KEY = 'chefai_saved_recipes_index_v2';
const ITEM_PREFIX = 'chefai_saved_recipe_v2:';
const META_SUFFIX = ':meta';
const BODY_SUFFIX = ':body';

const MAX_SAVED = 50;
/**
 * Android SQLite / CursorWindow per-row limit is easy to hit with UTF-8 (≥3 bytes/char for Bengali).
 * Stay well under ~1–2MB per row; large bodies use many small chunks.
 */
const MAX_CHARS_PER_BODY_CHUNK = 6144;

const MAX_DISH_NAME_LEN = 500;
const MAX_INGREDIENT_LEN = 8000;
const MAX_IMAGE_URL_LEN = 8000;
/** Cap every other string field — long Gemini lines can blow one SQLite row (Android CursorWindow). */
const MAX_MISC_STRING_LEN = 400;

/** Long IDs (e.g. `${dishName}-${time}`) blow up the index JSON in one SQLite row → CursorWindow on Android. */
const MAX_INDEX_JSON_CHARS = 350_000;
const MAX_ID_CHARS = 96;

export function makeShortRecipeId(): string {
  return `r${Date.now().toString(36)}x${Math.random().toString(36).slice(2, 12)}`;
}

export type StoredSavedRecipe = {
  id: string;
  dishName: string;
  recipe: string;
  imageUrl: string;
  ingredient?: string;
  cuisine?: string;
  language?: string;
  generationMode?: string;
  dietPreference?: string;
  spiceLevel?: string;
  maxCaloriesPerMeal?: string;
  servings?: string;
  difficultyLevel?: string;
  cookTimeMinutes?: string;
  nutritionCaloriesKcal?: string;
  nutritionProteinG?: string;
  nutritionCarbsG?: string;
  savedAt: string;
};

type RecipeMetaStored = Omit<StoredSavedRecipe, 'recipe'> & {
  recipeChunks: number;
};

function clip(s: string | undefined, max: number): string | undefined {
  if (s == null) return s;
  return s.length <= max ? s : s.slice(0, max);
}

function narrowMetaFields(rest: Omit<StoredSavedRecipe, 'recipe'>): Omit<StoredSavedRecipe, 'recipe'> {
  const raw = rest.id ?? '';
  const id = raw && raw.length <= MAX_ID_CHARS ? raw : makeShortRecipeId();
  return {
    ...rest,
    id,
    dishName: rest.dishName.slice(0, MAX_DISH_NAME_LEN),
    ingredient: rest.ingredient != null ? rest.ingredient.slice(0, MAX_INGREDIENT_LEN) : rest.ingredient,
    imageUrl: rest.imageUrl.slice(0, MAX_IMAGE_URL_LEN),
    cuisine: clip(rest.cuisine, MAX_MISC_STRING_LEN),
    language: clip(rest.language, MAX_MISC_STRING_LEN),
    generationMode: clip(rest.generationMode, MAX_MISC_STRING_LEN),
    dietPreference: clip(rest.dietPreference, MAX_MISC_STRING_LEN),
    spiceLevel: clip(rest.spiceLevel, MAX_MISC_STRING_LEN),
    maxCaloriesPerMeal: clip(rest.maxCaloriesPerMeal, MAX_MISC_STRING_LEN),
    servings: clip(rest.servings, MAX_MISC_STRING_LEN),
    difficultyLevel: clip(rest.difficultyLevel, MAX_MISC_STRING_LEN),
    cookTimeMinutes: clip(rest.cookTimeMinutes, MAX_MISC_STRING_LEN),
    nutritionCaloriesKcal: clip(rest.nutritionCaloriesKcal, MAX_MISC_STRING_LEN),
    nutritionProteinG: clip(rest.nutritionProteinG, MAX_MISC_STRING_LEN),
    nutritionCarbsG: clip(rest.nutritionCarbsG, MAX_MISC_STRING_LEN),
    savedAt: rest.savedAt.slice(0, MAX_MISC_STRING_LEN),
  };
}

function storageKeyId(item: StoredSavedRecipe): string {
  const { recipe: _r, ...rest } = item;
  return narrowMetaFields(rest).id;
}

function chunkRecipeBody(recipe: string): string[] {
  if (recipe.length <= MAX_CHARS_PER_BODY_CHUNK) return [recipe];
  const parts: string[] = [];
  for (let i = 0; i < recipe.length; i += MAX_CHARS_PER_BODY_CHUNK) {
    parts.push(recipe.slice(i, i + MAX_CHARS_PER_BODY_CHUNK));
  }
  return parts;
}

async function writeRecipeParts(item: StoredSavedRecipe): Promise<void> {
  const { recipe, ...rest } = item;
  const narrowRest = narrowMetaFields(rest);
  const sid = narrowRest.id;
  const chunks = chunkRecipeBody(recipe);
  const recipeChunks = chunks.length;

  const meta: RecipeMetaStored = { ...narrowRest, recipeChunks };
  await AsyncStorage.setItem(`${ITEM_PREFIX}${sid}${META_SUFFIX}`, JSON.stringify(meta));

  if (recipeChunks === 1) {
    await AsyncStorage.setItem(`${ITEM_PREFIX}${sid}${BODY_SUFFIX}`, chunks[0]);
    return;
  }
  for (let i = 0; i < chunks.length; i++) {
    await AsyncStorage.setItem(`${ITEM_PREFIX}${sid}${BODY_SUFFIX}:${i}`, chunks[i]);
  }
}

async function readRecipeParts(id: string): Promise<StoredSavedRecipe | null> {
  try {
    const metaRaw = await AsyncStorage.getItem(`${ITEM_PREFIX}${id}${META_SUFFIX}`);
    if (metaRaw) {
      try {
        const meta = JSON.parse(metaRaw) as RecipeMetaStored;
        const n = meta.recipeChunks;
        let recipe = '';
        if (n === 1) {
          recipe = (await AsyncStorage.getItem(`${ITEM_PREFIX}${id}${BODY_SUFFIX}`)) ?? '';
        } else {
          for (let i = 0; i < n; i++) {
            recipe += (await AsyncStorage.getItem(`${ITEM_PREFIX}${id}${BODY_SUFFIX}:${i}`)) ?? '';
          }
        }
        const { recipeChunks: _rc, ...rest } = meta;
        return { ...rest, recipe };
      } catch {
        return null;
      }
    }

    const legacyRow = await AsyncStorage.getItem(`${ITEM_PREFIX}${id}`);
    if (legacyRow) {
      try {
        const item = JSON.parse(legacyRow) as StoredSavedRecipe;
        if (item?.dishName) {
          const nid = makeShortRecipeId();
          const fixed = { ...item, id: nid };
          await writeRecipeParts(fixed);
          await AsyncStorage.removeItem(`${ITEM_PREFIX}${id}`);
          return fixed;
        }
      } catch {
        return null;
      }
    }
  } catch {
    return null;
  }
  return null;
}

async function deleteRecipeParts(id: string): Promise<void> {
  const metaRaw = await AsyncStorage.getItem(`${ITEM_PREFIX}${id}${META_SUFFIX}`);
  if (metaRaw) {
    try {
      const meta = JSON.parse(metaRaw) as RecipeMetaStored;
      const n = meta.recipeChunks ?? 1;
      if (n === 1) {
        await AsyncStorage.removeItem(`${ITEM_PREFIX}${id}${BODY_SUFFIX}`);
      } else {
        for (let i = 0; i < n; i++) {
          await AsyncStorage.removeItem(`${ITEM_PREFIX}${id}${BODY_SUFFIX}:${i}`);
        }
      }
    } catch {
      /* ignore */
    }
    await AsyncStorage.removeItem(`${ITEM_PREFIX}${id}${META_SUFFIX}`);
    return;
  }

  await AsyncStorage.removeItem(`${ITEM_PREFIX}${id}`);
  await AsyncStorage.removeItem(`${ITEM_PREFIX}${id}${BODY_SUFFIX}`);
  for (let i = 0; i < 64; i++) {
    await AsyncStorage.removeItem(`${ITEM_PREFIX}${id}${BODY_SUFFIX}:${i}`);
  }
}

/**
 * Re-key recipes when the index row or id strings are huge (legacy `${dishName}-timestamp` ids).
 */
async function repairOversizedIndexIfNeeded(): Promise<void> {
  const indexRaw = await AsyncStorage.getItem(INDEX_KEY);
  if (!indexRaw) return;
  let ids: unknown[];
  try {
    ids = JSON.parse(indexRaw) as unknown[];
    if (!Array.isArray(ids)) return;
  } catch {
    return;
  }
  const strIds = ids.filter((x): x is string => typeof x === 'string');
  const maxIdLen = strIds.reduce((m, x) => Math.max(m, x.length), 0);
  if (indexRaw.length <= MAX_INDEX_JSON_CHARS && maxIdLen <= MAX_ID_CHARS) return;

  const items: StoredSavedRecipe[] = [];
  for (const id of strIds) {
    const item = await readRecipeParts(id);
    if (item) items.push(item);
  }

  await AsyncStorage.removeItem(INDEX_KEY);
  for (const id of strIds) {
    await deleteRecipeParts(id);
  }

  const newIds: string[] = [];
  for (const item of items) {
    await writeRecipeParts(item);
    newIds.push(storageKeyId(item));
  }
  await AsyncStorage.setItem(INDEX_KEY, JSON.stringify(newIds));
}

export async function loadSavedRecipes(): Promise<StoredSavedRecipe[]> {
  await repairOversizedIndexIfNeeded();

  const indexRaw = await AsyncStorage.getItem(INDEX_KEY);
  if (indexRaw) {
    try {
      const ids = JSON.parse(indexRaw) as unknown;
      if (!Array.isArray(ids)) return [];
      const out: StoredSavedRecipe[] = [];
      for (const id of ids) {
        if (typeof id !== 'string') continue;
        const item = await readRecipeParts(id);
        if (item?.dishName) out.push(item);
      }
      return out;
    } catch {
      return [];
    }
  }

  let legacy: string | null = null;
  try {
    legacy = await AsyncStorage.getItem(LEGACY_SAVED_RECIPES_KEY);
  } catch {
    try {
      await AsyncStorage.removeItem(LEGACY_SAVED_RECIPES_KEY);
    } catch {
      /* ignore */
    }
    return [];
  }
  if (!legacy) return [];
  try {
    const arr = JSON.parse(legacy) as unknown;
    if (Array.isArray(arr) && arr.length > 0) {
      await migrateLegacyV1ToV2(arr as StoredSavedRecipe[]);
      return loadSavedRecipes();
    }
  } catch {
    return [];
  }
  return [];
}

async function migrateLegacyV1ToV2(items: StoredSavedRecipe[]) {
  const slice = items.slice(0, MAX_SAVED);
  const ids: string[] = [];
  for (const item of slice) {
    const id = makeShortRecipeId();
    const row = { ...item, id };
    ids.push(id);
    await writeRecipeParts(row);
  }
  await AsyncStorage.setItem(INDEX_KEY, JSON.stringify(ids));
  await AsyncStorage.removeItem(LEGACY_SAVED_RECIPES_KEY);
}

/** Upsert by dish name (replace duplicate dish), newest first, cap MAX_SAVED. */
export async function upsertSavedRecipe(item: StoredSavedRecipe): Promise<void> {
  const existing = await loadSavedRecipes();
  const withoutDup = existing.filter((x) => x.dishName !== item.dishName);
  const merged = [item, ...withoutDup].slice(0, MAX_SAVED);
  const newIds = merged.map((m) => storageKeyId(m));

  let oldIds: string[] = [];
  const ir = await AsyncStorage.getItem(INDEX_KEY);
  if (ir) {
    try {
      const p = JSON.parse(ir) as unknown;
      oldIds = Array.isArray(p) ? p.filter((x): x is string => typeof x === 'string') : [];
    } catch {
      oldIds = [];
    }
  }

  for (const id of oldIds) {
    if (!newIds.includes(id)) {
      await deleteRecipeParts(id);
    }
  }

  for (const m of merged) {
    await writeRecipeParts(m);
  }

  await AsyncStorage.setItem(INDEX_KEY, JSON.stringify(newIds));
}

/** Load one saved recipe by id (for shopping list, deep links, etc.). */
export async function getSavedRecipeById(id: string): Promise<StoredSavedRecipe | null> {
  if (!id?.trim()) return null;
  return readRecipeParts(id.trim());
}
