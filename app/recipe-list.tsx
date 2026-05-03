import { DesignerCreditLine } from '@/components/designer-footer';
import { HomeExploreNav, HOME_EXPLORE_NAV_RESERVED_BOTTOM } from '@/components/home-explore-nav';
import { DEFAULT_CUISINE, DEFAULT_UI_LANGUAGE } from '@/constants/app-defaults';
import {
  normalizeDietPreference,
  normalizeSpiceLevel,
} from '@/constants/recipe-preferences';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
export default function RecipeListScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    recipes?: string;
    ingredient?: string;
    selectedCuisine?: string;
    selectedLang?: string;
    generationMode?: string;
    dietPreference?: string;
    spiceLevel?: string;
    maxCaloriesPerMeal?: string;
  }>();

  const ingredient = params.ingredient ?? '';
  const selectedCuisine = params.selectedCuisine ?? DEFAULT_CUISINE;
  const selectedLang = params.selectedLang ?? DEFAULT_UI_LANGUAGE;
  const generationMode =
    params.generationMode === 'creative' || params.generationMode === 'strict' ? params.generationMode : 'strict';
  const dietPreference = normalizeDietPreference(params.dietPreference);
  const spiceLevel = normalizeSpiceLevel(params.spiceLevel);
  const maxCaloriesPerMeal = params.maxCaloriesPerMeal?.trim() ?? '';
  const [selectedRecipeLoading, setSelectedRecipeLoading] = useState<string | null>(null);

  const recipes = useMemo(() => {
    try {
      const parsed = JSON.parse(params.recipes ?? '[]');
      return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
    } catch {
      return [];
    }
  }, [params.recipes]);

  const handleRecipeSelect = (selectedRecipeName: string) => {
    setSelectedRecipeLoading(selectedRecipeName);
    router.push({
      pathname: '/recipe-details',
        params: {
        recipeName: selectedRecipeName,
        ingredient,
        selectedCuisine,
        selectedLang,
        generationMode,
        dietPreference,
        spiceLevel,
        maxCaloriesPerMeal,
      },
    });
    setTimeout(() => setSelectedRecipeLoading(null), 600);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.page}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 28 + HOME_EXPLORE_NAV_RESERVED_BOTTOM }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.summaryText}>
          Ingredient: {ingredient || 'N/A'}  |  Cuisine: {selectedCuisine}  |  Language: {selectedLang}  |  Mode:{' '}
          {generationMode}
          {'  |  '}
          Diet: {dietPreference}  |  Spice: {spiceLevel}
          {maxCaloriesPerMeal ? `  |  Max kcal: ${maxCaloriesPerMeal}` : ''}
        </Text>

        <View style={styles.recipeListCard}>
          <Text style={styles.listTitle}>Top Recipe Suggestions</Text>
          {recipes.length === 0 ? (
            <Text style={styles.emptyText}>No recipes found. Please go back and try again.</Text>
          ) : (
            recipes.map((item) => (
              <TouchableOpacity
                key={item}
                style={styles.recipeListItem}
                onPress={() => handleRecipeSelect(item)}
                disabled={selectedRecipeLoading === item}>
                {selectedRecipeLoading === item ? (
                  <View style={styles.recipeItemLoading}>
                    <ActivityIndicator size="small" color="#d3b275" />
                    <Text style={styles.recipeListItemText}>Loading...</Text>
                  </View>
                ) : (
                  <Text style={styles.recipeListItemText}>{item}</Text>
                )}
              </TouchableOpacity>
            ))
          )}
        </View>
        <DesignerCreditLine />
      </ScrollView>
      <HomeExploreNav />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  page: { flex: 1 },
  scrollContent: { padding: 20, alignItems: 'center' },
  backButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#111',
    borderWidth: 1,
    borderColor: '#d3b275',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginTop: 10,
    marginBottom: 16,
  },
  backButtonText: { color: '#d3b275', fontSize: 14, fontWeight: '600' },
  summaryText: { alignSelf: 'flex-start', color: '#9a9a9a', fontSize: 12, marginBottom: 16 },
  recipeListCard: { width: '100%', backgroundColor: '#111', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#222' },
  listTitle: { color: '#d3b275', fontSize: 20, fontWeight: 'bold', marginBottom: 12, textAlign: 'center' },
  recipeListItem: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#222' },
  recipeListItemText: { color: '#fff', fontSize: 16 },
  recipeItemLoading: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  emptyText: { color: '#bbb', fontSize: 14, textAlign: 'center', paddingVertical: 14 },
});
