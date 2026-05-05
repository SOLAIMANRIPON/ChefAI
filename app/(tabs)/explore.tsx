import {
  type DifficultyLevel,
  normalizeDifficultyLevel,
  type DietPreference,
  type SpiceLevel,
  normalizeDietPreference,
  normalizeSpiceLevel,
  parseCookTimeMinutesParam,
  parseServingsParam,
} from '@/constants/recipe-preferences';
import { DesignerCreditLine } from '@/components/designer-footer';
import { DEFAULT_CUISINE, DEFAULT_UI_LANGUAGE } from '@/constants/app-defaults';
import { loadSavedRecipes } from '@/constants/saved-recipes-storage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import React from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';

const RECENT_VIEWS_STORAGE_KEY = 'chefai_recent_views_v1';
const RECENT_SEARCHES_STORAGE_KEY = 'chefai_recent_searches_v1';

type SavedRecipe = {
  id: string;
  dishName: string;
  ingredient?: string;
  cuisine?: string;
  language?: string;
  generationMode?: 'strict' | 'creative';
  dietPreference?: DietPreference;
  spiceLevel?: SpiceLevel;
  maxCaloriesPerMeal?: string;
  servings?: string;
  difficultyLevel?: DifficultyLevel;
  cookTimeMinutes?: string;
};

type RecentView = {
  id: string;
  recipeName: string;
  ingredient?: string;
  cuisine?: string;
  language?: string;
};

type RecentSearch = {
  query: string;
  cuisine: string;
  language: string;
  at: string;
  servings?: string;
  difficultyLevel?: DifficultyLevel;
  cookTimeMinutes?: string;
};

export default function ExploreScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [savedRecipes, setSavedRecipes] = React.useState<SavedRecipe[]>([]);
  const [recentViews, setRecentViews] = React.useState<RecentView[]>([]);
  const [recentSearches, setRecentSearches] = React.useState<RecentSearch[]>([]);

  const loadExploreData = React.useCallback(async () => {
    try {
      const [savedList, viewsRaw, searchesRaw] = await Promise.all([
        loadSavedRecipes(),
        AsyncStorage.getItem(RECENT_VIEWS_STORAGE_KEY),
        AsyncStorage.getItem(RECENT_SEARCHES_STORAGE_KEY),
      ]);
      setSavedRecipes(savedList);
      setRecentViews(viewsRaw ? JSON.parse(viewsRaw) : []);
      setRecentSearches(searchesRaw ? JSON.parse(searchesRaw) : []);
    } catch {
      setSavedRecipes([]);
      setRecentViews([]);
      setRecentSearches([]);
    }
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      loadExploreData();
    }, [loadExploreData])
  );

  const trendingDishes = React.useMemo(() => {
    const counts: Record<string, number> = {};
    recentViews.forEach((item) => {
      const key = item.recipeName?.trim();
      if (!key) return;
      counts[key] = (counts[key] || 0) + 1;
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name]) => name);
  }, [recentViews]);

  const openRecipe = (
    recipeName: string,
    ingredient = '',
    cuisine = DEFAULT_CUISINE,
    language = DEFAULT_UI_LANGUAGE,
    generationMode: 'strict' | 'creative' = 'strict',
    dietPreference: DietPreference = 'none',
    spiceLevel: SpiceLevel = 'medium',
    maxCaloriesPerMeal = '',
    servings = '',
    difficultyLevel: DifficultyLevel = 'medium',
    cookTimeMinutes = '',
    recipeId = ''
  ) => {
    router.push({
      pathname: '/recipe-details',
      params: {
        recipeName,
        ingredient,
        selectedCuisine: cuisine,
        selectedLang: language,
        generationMode,
        dietPreference,
        spiceLevel,
        maxCaloriesPerMeal,
        servings: String(parseServingsParam(servings)),
        difficultyLevel: normalizeDifficultyLevel(difficultyLevel),
        cookTimeMinutes: parseCookTimeMinutesParam(cookTimeMinutes) != null ? String(parseCookTimeMinutesParam(cookTimeMinutes)) : '',
        recipeId,
      },
    });
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.container}>
      <Text style={styles.title}>{t('explore.title')}</Text>
      <Text style={styles.subtitle}>{t('explore.subtitle')}</Text>

      <TouchableOpacity
        style={styles.settingsEntry}
        onPress={() => router.push('/settings')}
        activeOpacity={0.85}>
        <Text style={styles.settingsEntryTitle}>{t('explore.openSettings')}</Text>
        <Text style={styles.settingsEntryDesc}>{t('explore.openSettingsDesc')}</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.shoppingEntry}
        onPress={() => router.push('/shopping-lists')}
        activeOpacity={0.85}>
        <Text style={styles.shoppingEntryTitle}>{t('explore.shoppingTitle')}</Text>
        <Text style={styles.shoppingEntryDesc}>{t('explore.shoppingDesc')}</Text>
      </TouchableOpacity>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('explore.savedRecipes')}</Text>
        {savedRecipes.length === 0 ? (
          <Text style={styles.emptyText}>{t('explore.savedEmpty')}</Text>
        ) : (
          savedRecipes.slice(0, 12).map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.item}
              onPress={() =>
                openRecipe(
                  item.dishName,
                  item.ingredient,
                  item.cuisine,
                  item.language,
                  item.generationMode === 'creative' ? 'creative' : 'strict',
                  normalizeDietPreference(item.dietPreference),
                  normalizeSpiceLevel(item.spiceLevel),
                  item.maxCaloriesPerMeal ?? '',
                  item.servings ?? '',
                  normalizeDifficultyLevel(item.difficultyLevel),
                  item.cookTimeMinutes ?? '',
                  item.id
                )}>
              <View style={styles.itemHeadCol}>
                <Text style={styles.itemTitle}>{item.dishName}</Text>
                <View style={styles.offlineBadge}>
                  <Text style={styles.offlineBadgeText}>Offline available</Text>
                </View>
              </View>
              <Text style={styles.itemMeta}>
                {item.cuisine || t('explore.cuisine')} | {item.language || t('explore.language')}
              </Text>
            </TouchableOpacity>
          ))
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('explore.trending')}</Text>
        {trendingDishes.length === 0 ? (
          <Text style={styles.emptyText}>{t('explore.trendingEmpty')}</Text>
        ) : (
          trendingDishes.map((name) => (
            <TouchableOpacity key={name} style={styles.item} onPress={() => openRecipe(name)}>
              <Text style={styles.itemTitle}>{name}</Text>
            </TouchableOpacity>
          ))
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('explore.recentHistory')}</Text>
        {recentSearches.length === 0 ? (
          <Text style={styles.emptyText}>{t('explore.recentEmpty')}</Text>
        ) : (
          recentSearches.slice(0, 12).map((item, idx) => (
            <TouchableOpacity
              key={`${item.query}-${idx}`}
              style={styles.item}
              onPress={() =>
                router.push({
                  pathname: '/craft',
                  params: {
                    ingredient: item.query,
                    selectedLang: item.language,
                    selectedCuisine: item.cuisine,
                    servings: item.servings ?? '',
                    difficultyLevel: normalizeDifficultyLevel(item.difficultyLevel),
                    cookTimeMinutes: item.cookTimeMinutes ?? '',
                  },
                })
              }>
              <Text style={styles.itemTitle}>{item.query}</Text>
              <Text style={styles.itemMeta}>
                {item.cuisine} | {item.language}
              </Text>
            </TouchableOpacity>
          ))
        )}
      </View>

      <DesignerCreditLine />
    </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#000' },
  container: { padding: 20, backgroundColor: '#000', paddingBottom: 80 },
  title: { color: '#d3b275', fontSize: 30, fontWeight: 'bold', marginTop: 50 },
  subtitle: { color: '#9a9a9a', fontSize: 13, marginTop: 6, marginBottom: 16 },
  settingsEntry: {
    backgroundColor: '#101820',
    borderWidth: 1,
    borderColor: '#2a3540',
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
  },
  settingsEntryTitle: { color: '#c9af80', fontSize: 17, fontWeight: '700', marginBottom: 8 },
  settingsEntryDesc: { color: '#a8a8a8', fontSize: 13, lineHeight: 20 },
  shoppingEntry: {
    backgroundColor: '#141208',
    borderWidth: 1,
    borderColor: '#3d3420',
    borderRadius: 14,
    padding: 16,
    marginBottom: 18,
  },
  shoppingEntryTitle: { color: '#d3b275', fontSize: 18, fontWeight: '700', marginBottom: 8 },
  shoppingEntryDesc: { color: '#a8a8a8', fontSize: 13, lineHeight: 20 },
  section: {
    backgroundColor: '#111',
    borderWidth: 1,
    borderColor: '#222',
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
  },
  sectionTitle: { color: '#d3b275', fontSize: 18, fontWeight: '700', marginBottom: 10 },
  item: { borderTopWidth: 1, borderTopColor: '#222', paddingVertical: 10 },
  itemHeadCol: { gap: 6 },
  itemTitle: { color: '#fff', fontSize: 15, fontWeight: '600' },
  itemMeta: { color: '#8f8f8f', fontSize: 12, marginTop: 4 },
  offlineBadge: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#2f3f2f',
    backgroundColor: '#0f1b0f',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  offlineBadgeText: { color: '#9fca9f', fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  emptyText: { color: '#8f8f8f', fontSize: 13, paddingVertical: 6 },
});
