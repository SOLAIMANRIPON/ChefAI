import { DesignerCreditLine } from '@/components/designer-footer';
import { HomeExploreNav, HOME_EXPLORE_NAV_RESERVED_BOTTOM } from '@/components/home-explore-nav';
import {
  mergeShoppingItemsToIngredientNames,
  normalizeShoppingIngredientLabels,
} from '@/constants/shopping-ingredient-label';
import { extractShoppingItemsFromRecipeText } from '@/constants/shopping-list-fallback';
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
import {
  ActivityIndicator,
  FlatList,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

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
  language: string
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
  const [language, setLanguage] = React.useState('বাংলা');
  const [fallbackNote, setFallbackNote] = React.useState(false);

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

  const generateAndStore = React.useCallback(async (rid: string, name: string, body: string, lang: string) => {
    setGenerating(true);
    setError('');
    setFallbackNote(false);
    try {
      const apiLabels = await fetchShoppingItemsFromApi(body, name, lang);
      const localLabels = extractShoppingItemsFromRecipeText(body);
      const mergedRaw = apiLabels.length > 0 ? apiLabels : localLabels;
      const labels = normalizeShoppingIngredientLabels(mergedRaw);
      setFallbackNote(apiLabels.length === 0 && localLabels.length > 0);
      if (!labels.length) {
        setError(
          API_BASE_URL
            ? 'লিস্ট তৈরি করা গেল না। সার্ভার আপডেট করুন অথবা রেসিপিতে উপকরণ/পরিমাণ স্পষ্ট থাকা প্রয়োজন।'
            : 'লিস্ট তৈরি করা গেল না। EXPO_PUBLIC_API_BASE_URL সেট করুন অথবা রেসিপি টেক্সট পর্যাপ্ত নয়।'
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
      setError('রেসিপি আইডি নেই।');
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
          setError('রেসিপি পাওয়া যায়নি। আগে সেভ করা রেসিপি বেছে নিন।');
          setLoadingRecipe(false);
          return;
        }
        const name = recipe.dishName || 'Recipe';
        setDishName(name);
        setRecipeBody(recipe.recipe);
        setLanguage(recipe.language || 'বাংলা');

        const hasStored = await reloadFromStorage(recipeId, name);
        if (cancelled) return;

        if (hasStored) {
          setLoadingRecipe(false);
          return;
        }

        if (!recipe.recipe.trim()) {
          setError('রেসিপি টেক্সট খালি—শপিং লিস্ট বানানো যাবে না।');
          setLoadingRecipe(false);
          return;
        }

        setLoadingRecipe(false);
        await generateAndStore(recipeId, name, recipe.recipe, recipe.language || 'বাংলা');
      } catch {
        if (!cancelled) setError('লোড করা যায়নি।');
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
    if (!recipeId || !recipeBody.trim()) {
      setError('রেসিপি টেক্সট নেই।');
      return;
    }
    void generateAndStore(recipeId, dishName, recipeBody, language);
  };

  const remaining = items.filter((x) => !x.checked).length;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.page}>
      <TouchableOpacity style={styles.back} onPress={() => router.back()}>
        <Text style={styles.backText}>Back</Text>
      </TouchableOpacity>

      <Text style={styles.title}>{dishName || 'Shopping list'}</Text>
      <Text style={styles.sub}>
        {items.length > 0 ? `বাকি ${remaining} / মোট ${items.length}` : ' '}
      </Text>

      {fallbackNote && items.length > 0 ? (
        <Text style={styles.fallbackNote}>
          সার্ভার লিস্ট unavailable — রেসিপি টেক্সট থেকে স্বয়ংক্রিয় সংক্ষিপ্ত লিস্ট। নতুন সার্ভার ডিপ্লয় করলে আরও নির্ভুল হবে।
        </Text>
      ) : null}

      {loadingRecipe || generating ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color="#d3b275" />
          <Text style={styles.loaderText}>
            {generating ? 'উপকরণের লিস্ট তৈরি হচ্ছে…' : 'লোড হচ্ছে…'}
          </Text>
        </View>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {!loadingRecipe && !generating && items.length > 0 ? (
        <>
          <TouchableOpacity style={styles.regenBtn} onPress={onRegenerate} disabled={generating}>
            <Text style={styles.regenText}>লিস্ট আবার তৈরি করুন</Text>
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
        <Text style={styles.empty}>কোনো আইটেম নেই।</Text>
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
