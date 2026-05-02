import { ingredientNameOnly } from '@/constants/shopping-ingredient-label';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SHOPPING_LISTS_KEY = 'chefai_shopping_lists_v1';

export type ShoppingItem = { id: string; label: string; checked: boolean };

export type StoredShoppingList = {
  dishName: string;
  items: ShoppingItem[];
};

function normalizeLabel(s: string) {
  return s.trim().toLowerCase();
}

async function loadAll(): Promise<Record<string, StoredShoppingList>> {
  try {
    const raw = await AsyncStorage.getItem(SHOPPING_LISTS_KEY);
    if (!raw) return {};
    const p = JSON.parse(raw) as unknown;
    if (typeof p !== 'object' || p === null || Array.isArray(p)) return {};
    return p as Record<string, StoredShoppingList>;
  } catch {
    return {};
  }
}

async function saveAll(all: Record<string, StoredShoppingList>): Promise<void> {
  await AsyncStorage.setItem(SHOPPING_LISTS_KEY, JSON.stringify(all));
}

export async function getShoppingList(recipeId: string): Promise<StoredShoppingList | null> {
  const all = await loadAll();
  const row = all[recipeId];
  if (!row?.items || !Array.isArray(row.items)) return null;
  return row;
}

export async function upsertShoppingList(recipeId: string, data: StoredShoppingList): Promise<void> {
  const all = await loadAll();
  all[recipeId] = {
    dishName: data.dishName.slice(0, 500),
    items: data.items.slice(0, 80).map((x) => ({
      id: x.id.slice(0, 64),
      label: x.label.slice(0, 400),
      checked: Boolean(x.checked),
    })),
  };
  await saveAll(all);
}

/** Replace items; keep checked state when the same label appears again. */
export async function setShoppingItems(
  recipeId: string,
  dishName: string,
  labels: string[]
): Promise<void> {
  const existing = await getShoppingList(recipeId);
  const checkedByLabel = new Map<string, boolean>();
  for (const x of existing?.items ?? []) {
    checkedByLabel.set(normalizeLabel(ingredientNameOnly(x.label)), x.checked);
  }
  const seen = new Set<string>();
  const items: ShoppingItem[] = [];
  for (const raw of labels) {
    const label = ingredientNameOnly(raw.trim());
    if (!label) continue;
    const key = normalizeLabel(label);
    if (seen.has(key)) continue;
    seen.add(key);
    items.push({
      id: `sl_${recipeId.slice(0, 12)}_${items.length}_${Math.random().toString(36).slice(2, 9)}`,
      label,
      checked: checkedByLabel.get(key) ?? false,
    });
  }
  await upsertShoppingList(recipeId, { dishName, items });
}

export async function toggleShoppingItem(recipeId: string, itemId: string): Promise<void> {
  const cur = await getShoppingList(recipeId);
  if (!cur) return;
  const items = cur.items.map((x) => (x.id === itemId ? { ...x, checked: !x.checked } : x));
  await upsertShoppingList(recipeId, { ...cur, items });
}

export async function removeShoppingList(recipeId: string): Promise<void> {
  const all = await loadAll();
  delete all[recipeId];
  await saveAll(all);
}
