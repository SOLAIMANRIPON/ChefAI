import { DesignerCreditLine } from '@/components/designer-footer';
import { HomeExploreNav, HOME_EXPLORE_NAV_RESERVED_BOTTOM } from '@/components/home-explore-nav';
import { resolveUiLanguageKey } from '@/constants/language-alias';
import {
  mergeShoppingItemsToIngredientNames,
  normalizeShoppingIngredientLabels,
} from '@/constants/shopping-ingredient-label';
import { extractShoppingItemsFromRecipeText } from '@/constants/shopping-list-fallback';
import { parseServingsParam } from '@/constants/recipe-preferences';
import { getSavedRecipeById } from '@/constants/saved-recipes-storage';
import {
  getShoppingList,
  setShoppingItems,
  toggleShoppingItem,
  upsertShoppingList,
  type ShoppingItem,
} from '@/constants/shopping-list-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();

function apiOrigin(base: string): string {
  return base.replace(/\/+$/, '');
}

const fetchWithTimeout = async (url: string, options: RequestInit, timeoutMs: number) => {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(t);
  }
};

/** Returns [] if URL missing, network error, or non-OK response (e.g. old backend without route). */
async function fetchShoppingItemsFromApi(
  recipeText: string,
  dishName: string,
  language: string,
  servings: number,
  ingredients?: string[]
): Promise<string[]> {
  if (!API_BASE_URL) return [];
  try {
    const res = await fetchWithTimeout(
      `${apiOrigin(API_BASE_URL)}/api/v1/ai/recipes/shopping-list`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipeText,
          dishName,
          language,
          servings,
          ...(ingredients && ingredients.length ? { ingredients } : {}),
        }),
      },
      45000
    );
    if (!res.ok) return [];
    const data = await res.json();
    const items = data?.items;
    if (!Array.isArray(items)) return [];
    return items.filter((x: unknown): x is string => typeof x === 'string').map((s) => s.trim()).filter(Boolean);
  } catch {
    return [];
  }
}

type ShoppingUi = {
  back: string;
  fallbackTitle: string;
  remainingOf: (remaining: number, total: number) => string;
  regenerate: string;
  fallbackNote: string;
  generating: string;
  loading: string;
  errorNoRecipeId: string;
  errorRecipeNotFound: string;
  errorEmptyRecipe: string;
  errorLoadFailed: string;
  errorNoRecipeText: string;
  errorListBuildServer: string;
  errorListBuildNoApiBase: string;
  emptyItems: string;
};

const EN_SHOPPING_UI: ShoppingUi = {
  back: 'Back',
  fallbackTitle: 'Shopping list',
  remainingOf: (remaining, total) => `${remaining} of ${total} remaining`,
  regenerate: 'Regenerate list',
  fallbackNote:
    'Server list unavailable — auto-extracted a short list from the recipe text. Deploy the latest backend for more accurate results.',
  generating: 'Building ingredient list…',
  loading: 'Loading…',
  errorNoRecipeId: 'Recipe ID missing.',
  errorRecipeNotFound: 'Recipe not found. Please pick a saved recipe first.',
  errorEmptyRecipe: 'Recipe is empty — cannot build a shopping list.',
  errorLoadFailed: 'Failed to load.',
  errorNoRecipeText: 'No recipe text available.',
  errorListBuildServer:
    'Could not build the list. Update the backend, or make sure the recipe lists ingredients with quantities.',
  errorListBuildNoApiBase:
    'Could not build the list. Check your connection or add more ingredient detail to the recipe.',
  emptyItems: 'No items.',
};

const SHOPPING_UI_TEXT: Record<string, ShoppingUi> = {
  বাংলা: {
    back: 'ফিরে যান',
    fallbackTitle: 'শপিং লিস্ট',
    remainingOf: (remaining, total) => `বাকি ${remaining} / মোট ${total}`,
    regenerate: 'লিস্ট আবার তৈরি করুন',
    fallbackNote:
      'সার্ভার লিস্ট unavailable — রেসিপি টেক্সট থেকে স্বয়ংক্রিয় সংক্ষিপ্ত লিস্ট। নতুন সার্ভার ডিপ্লয় করলে আরও নির্ভুল হবে।',
    generating: 'উপকরণের লিস্ট তৈরি হচ্ছে…',
    loading: 'লোড হচ্ছে…',
    errorNoRecipeId: 'রেসিপি আইডি নেই।',
    errorRecipeNotFound: 'রেসিপি পাওয়া যায়নি। আগে সেভ করা রেসিপি বেছে নিন।',
    errorEmptyRecipe: 'রেসিপি টেক্সট খালি—শপিং লিস্ট বানানো যাবে না।',
    errorLoadFailed: 'লোড করা যায়নি।',
    errorNoRecipeText: 'রেসিপি টেক্সট নেই।',
    errorListBuildServer:
      'লিস্ট তৈরি করা গেল না। সার্ভার আপডেট করুন অথবা রেসিপিতে উপকরণ/পরিমাণ স্পষ্ট থাকা প্রয়োজন।',
    errorListBuildNoApiBase:
      'লিস্ট তৈরি করা গেল না। EXPO_PUBLIC_API_BASE_URL সেট করুন অথবা রেসিপি টেক্সট পর্যাপ্ত নয়।',
    emptyItems: 'কোনো আইটেম নেই।',
  },
  English: EN_SHOPPING_UI,
  Hindi: EN_SHOPPING_UI,
  Arabic: EN_SHOPPING_UI,
  French: EN_SHOPPING_UI,
  Spanish: EN_SHOPPING_UI,
  Urdu: EN_SHOPPING_UI,
  Japanese: EN_SHOPPING_UI,
  Chinese: EN_SHOPPING_UI,
  Korean: EN_SHOPPING_UI,
  Turkish: EN_SHOPPING_UI,
  Persian: EN_SHOPPING_UI,
  Greek: EN_SHOPPING_UI,
  Portuguese: EN_SHOPPING_UI,
};

function resolveShoppingUi(language: string): ShoppingUi {
  return SHOPPING_UI_TEXT[resolveUiLanguageKey(language)] ?? EN_SHOPPING_UI;
}

export default function ShoppingListScreen() {
  const router = useRouter();
  const { recipeId: recipeIdParam } = useLocalSearchParams<{ recipeId?: string }>();
  const recipeId = typeof recipeIdParam === 'string' ? recipeIdParam : '';

  const [dishName, setDishName] = React.useState('');
  const [items, setItems] = React.useState<ShoppingItem[]>([]);
  const [loadingRecipe, setLoadingRecipe] = React.useState(true);
  const [generating, setGenerating] = React.useState(false);
  const [error, setError] = React.useState('');
  const [recipeBody, setRecipeBody] = React.useState('');
  const [language, setLanguage] = React.useState('English');
  const [fallbackNote, setFallbackNote] = React.useState(false);
  const [recipeServings, setRecipeServings] = React.useState(4);
  const [structuredIngredients, setStructuredIngredients] = React.useState<string[]>([]);

  const ui = React.useMemo(() => resolveShoppingUi(language), [language]);

  const reloadFromStorage = React.useCallback(async (rid: string, name: string) => {
    const stored = await getShoppingList(rid);
    if (stored?.items?.length) {
      const merged = mergeShoppingItemsToIngredientNames(stored.items) as ShoppingItem[];
      setItems(merged);
      setDishName(stored.dishName || name);
      await upsertShoppingList(rid, { dishName: stored.dishName || name, items: merged }).catch(() => {});
      return true;
    }
    return false;
  }, []);

  const generateAndStore = React.useCallback(async (
    rid: string,
    name: string,
    body: string,
    lang: string,
    servings: number,
    ingredientsArr?: string[]
  ) => {
    setGenerating(true);
    setError('');
    setFallbackNote(false);
    // Resolve UI strings from the recipe's language so error toasts in this
    // callback match the recipe context (the `ui` from React state may lag if
    // generateAndStore is invoked before the language state has settled).
    const callbackUi = resolveShoppingUi(lang);
    try {
      const apiLabels = await fetchShoppingItemsFromApi(body, name, lang, servings, ingredientsArr);
      const localLabels = ingredientsArr && ingredientsArr.length > 0
        ? ingredientsArr
        : extractShoppingItemsFromRecipeText(body);
      const mergedRaw = apiLabels.length > 0 ? apiLabels : localLabels;
      const labels = normalizeShoppingIngredientLabels(mergedRaw);
      setFallbackNote(apiLabels.length === 0 && localLabels.length > 0);
      if (!labels.length) {
        setError(
          API_BASE_URL ? callbackUi.errorListBuildServer : callbackUi.errorListBuildNoApiBase
        );
        return;
      }
      await setShoppingItems(rid, name, labels);
      const again = await getShoppingList(rid);
      setItems(again?.items ?? []);
      setDishName(name);
    } finally {
      setGenerating(false);
    }
  }, []);

  React.useEffect(() => {
    if (!recipeId) {
      setLoadingRecipe(false);
      setError(EN_SHOPPING_UI.errorNoRecipeId);
      return;
    }

    let cancelled = false;
    (async () => {
      setLoadingRecipe(true);
      setError('');
      try {
        const recipe = await getSavedRecipeById(recipeId);
        if (cancelled) return;
        if (!recipe) {
          // No recipe loaded yet, so use English (we don't know the recipe's language).
          setError(EN_SHOPPING_UI.errorRecipeNotFound);
          setLoadingRecipe(false);
          return;
        }
        const recipeLang = recipe.language || 'English';
        const recipeUi = resolveShoppingUi(recipeLang);
        const name = recipe.dishName || 'Recipe';
        const ingredientsArr = recipe.ingredientsList ?? [];
        setDishName(name);
        setRecipeBody(recipe.recipe);
        setLanguage(recipeLang);
        setRecipeServings(parseServingsParam(recipe.servings));
        setStructuredIngredients(ingredientsArr);

        const hasStored = await reloadFromStorage(recipeId, name);
        if (cancelled) return;

        if (hasStored) {
          setLoadingRecipe(false);
          return;
        }

        if (!recipe.recipe.trim() && !ingredientsArr.length) {
          setError(recipeUi.errorEmptyRecipe);
          setLoadingRecipe(false);
          return;
        }

        setLoadingRecipe(false);
        await generateAndStore(
          recipeId,
          name,
          recipe.recipe,
          recipeLang,
          parseServingsParam(recipe.servings),
          ingredientsArr.length ? ingredientsArr : undefined
        );
      } catch {
        if (!cancelled) setError(EN_SHOPPING_UI.errorLoadFailed);
        if (!cancelled) setLoadingRecipe(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [recipeId, generateAndStore, reloadFromStorage]);

  const onToggle = async (itemId: string) => {
    if (!recipeId) return;
    await toggleShoppingItem(recipeId, itemId);
    const next = await getShoppingList(recipeId);
    if (next?.items) setItems(next.items);
  };

  const onRegenerate = () => {
    if (!recipeId || (!recipeBody.trim() && structuredIngredients.length === 0)) {
      setError(ui.errorNoRecipeText);
      return;
    }
    void generateAndStore(
      recipeId,
      dishName,
      recipeBody,
      language,
      recipeServings,
      structuredIngredients.length ? structuredIngredients : undefined
    );
  };

  const remaining = items.filter((x) => !x.checked).length;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.page}>
      <TouchableOpacity style={styles.back} onPress={() => router.back()}>
        <Text style={styles.backText}>{ui.back}</Text>
      </TouchableOpacity>

      <Text style={styles.title}>{dishName || ui.fallbackTitle}</Text>
      <Text style={styles.sub}>
        {items.length > 0 ? ui.remainingOf(remaining, items.length) : ' '}
      </Text>

      {fallbackNote && items.length > 0 ? (
        <Text style={styles.fallbackNote}>{ui.fallbackNote}</Text>
      ) : null}

      {loadingRecipe || generating ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color="#d3b275" />
          <Text style={styles.loaderText}>
            {generating ? ui.generating : ui.loading}
          </Text>
        </View>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {!loadingRecipe && !generating && items.length > 0 ? (
        <>
          <TouchableOpacity style={styles.regenBtn} onPress={onRegenerate} disabled={generating}>
            <Text style={styles.regenText}>{ui.regenerate}</Text>
          </TouchableOpacity>
          <FlatList
            style={styles.listFlex}
            data={items}
            keyExtractor={(it) => it.id}
            contentContainerStyle={{ paddingBottom: 24 + HOME_EXPLORE_NAV_RESERVED_BOTTOM }}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.line}
                onPress={() => void onToggle(item.id)}
                activeOpacity={0.7}>
                <View style={[styles.box, item.checked && styles.boxOn]}>
                  {item.checked ? <Text style={styles.check}>✓</Text> : null}
                </View>
                <Text style={[styles.lineText, item.checked && styles.lineDone]}>{item.label}</Text>
              </TouchableOpacity>
            )}
          />
        </>
      ) : null}

      {!loadingRecipe && !generating && !error && items.length === 0 ? (
        <Text style={styles.empty}>{ui.emptyItems}</Text>
      ) : null}
      <DesignerCreditLine />
      <HomeExploreNav />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', paddingHorizontal: 20 },
  page: { flex: 1 },
  back: {
    alignSelf: 'flex-start',
    marginTop: 42,
    marginBottom: 16,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#d3b275',
    backgroundColor: '#111',
  },
  backText: { color: '#d3b275', fontWeight: '600', fontSize: 14 },
  title: { color: '#d3b275', fontSize: 24, fontWeight: 'bold', textAlign: 'center' },
  sub: { color: '#8f8f8f', fontSize: 13, textAlign: 'center', marginTop: 8, marginBottom: 12 },
  fallbackNote: {
    color: '#a8946a',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 10,
    paddingHorizontal: 8,
  },
  loader: { alignItems: 'center', marginTop: 40 },
  loaderText: { color: '#9a9a9a', marginTop: 12, fontSize: 14 },
  error: { color: '#ff7f7f', textAlign: 'center', marginTop: 16, lineHeight: 22 },
  regenBtn: {
    alignSelf: 'center',
    marginBottom: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#444',
  },
  regenText: { color: '#d3b275', fontWeight: '600', fontSize: 13 },
  listFlex: { flex: 1 },
  line: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#1a1a1a' },
  box: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#666',
    marginRight: 12,
    marginTop: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  boxOn: { borderColor: '#d3b275', backgroundColor: '#1c1810' },
  check: { color: '#d3b275', fontSize: 14, fontWeight: 'bold' },
  lineText: { flex: 1, color: '#e8e8e8', fontSize: 16, lineHeight: 24 },
  lineDone: { color: '#6a6a6a', textDecorationLine: 'line-through' },
  empty: { color: '#8f8f8f', textAlign: 'center', marginTop: 24 },
});
