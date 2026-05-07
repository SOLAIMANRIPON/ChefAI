import { DesignerCreditLine } from '@/components/designer-footer';
import { HomeExploreNav, HOME_EXPLORE_NAV_RESERVED_BOTTOM } from '@/components/home-explore-nav';
import { DEFAULT_CUISINE, DEFAULT_UI_LANGUAGE } from '@/constants/app-defaults';
import { getSaveRecipeAlerts } from '@/constants/save-recipe-alerts';
import {
  normalizeDifficultyLevel,
  normalizeDietPreference,
  normalizeSpiceLevel,
  parseCookTimeMinutesParam,
  parseMaxCaloriesParam,
  parseServingsParam,
} from '@/constants/recipe-preferences';
import { saveCookModeSession } from '@/constants/cook-mode-session';
import { getSavedRecipeById, makeShortRecipeId, upsertSavedRecipe, type StoredSavedRecipe } from '@/constants/saved-recipes-storage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;
const RECENT_VIEWS_STORAGE_KEY = 'chefai_recent_views_v1';
// Locked timeout/retry policy for production stability.
type NutritionEstimate = { caloriesKcal: number | null; proteinG: number | null; carbsG: number | null };
const EMPTY_NUTRITION: NutritionEstimate = { caloriesKcal: null, proteinG: null, carbsG: null };
const recipeDetailsCache: Record<string, { dishName: string; recipe: string; imageUrl: string; nutrition: NutritionEstimate }> = {};

const isAbortError = (error: unknown) =>
  error instanceof Error && error.name === 'AbortError';

const fetchWithTimeout = async (url: string, options: RequestInit, timeoutMs: number) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
};

const cleanRecipeText = (text: string) =>
  text
    .replace(/\*\*/g, '')
    .replace(/^\s*[-*]\s+/gm, '• ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

/** Base64 data URLs are huge and break AsyncStorage / localStorage quota; keep only short http(s) images. */
const persistableImageUrl = (url: string) => {
  const u = url.trim();
  if (!u) return '';
  if (u.startsWith('data:')) return '';
  if (u.length > 8000) return '';
  return u;
};

export default function RecipeDetailsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    recipeName?: string;
    ingredient?: string;
    selectedCuisine?: string;
    selectedLang?: string;
    generationMode?: string;
    dietPreference?: string;
    spiceLevel?: string;
    maxCaloriesPerMeal?: string;
    servings?: string;
    difficultyLevel?: string;
    cookTimeMinutes?: string;
    recipeId?: string;
  }>();

  const recipeName = params.recipeName ?? 'Recipe';
  const ingredient = params.ingredient ?? '';
  const selectedCuisine = params.selectedCuisine ?? DEFAULT_CUISINE;
  const selectedLang = params.selectedLang ?? DEFAULT_UI_LANGUAGE;
  const generationMode =
    params.generationMode === 'creative' || params.generationMode === 'strict' ? params.generationMode : 'strict';
  const dietPreference = normalizeDietPreference(params.dietPreference);
  const spiceLevel = normalizeSpiceLevel(params.spiceLevel);
  const maxCaloriesPerMeal = parseMaxCaloriesParam(params.maxCaloriesPerMeal);
  const servings = parseServingsParam(params.servings);
  const difficultyLevel = normalizeDifficultyLevel(params.difficultyLevel);
  const cookTimeMinutes = parseCookTimeMinutesParam(params.cookTimeMinutes);
  const recipeId = typeof params.recipeId === 'string' ? params.recipeId.trim() : '';

  const [dishName, setDishName] = useState(recipeName);
  const [recipe, setRecipe] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [imageError, setImageError] = useState(false);
  const [imageFallbackTried, setImageFallbackTried] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [nutrition, setNutrition] = useState<NutritionEstimate>(EMPTY_NUTRITION);

  const saveRecentView = useCallback(async (name: string) => {
    try {
      const raw = await AsyncStorage.getItem(RECENT_VIEWS_STORAGE_KEY);
      const previous = raw ? JSON.parse(raw) : [];
      const nextItem = {
        id: `${name}-${Date.now()}`,
        recipeName: name,
        ingredient,
        cuisine: selectedCuisine,
        language: selectedLang,
        at: new Date().toISOString(),
      };
      const deduped = [nextItem, ...previous.filter((item: any) => item?.recipeName !== name)];
      await AsyncStorage.setItem(RECENT_VIEWS_STORAGE_KEY, JSON.stringify(deduped.slice(0, 30)));
    } catch {
      // Ignore history persistence failures.
    }
  }, [ingredient, selectedCuisine, selectedLang]);

  const openCookMode = async () => {
    if (!recipe.trim()) return;
    await saveCookModeSession({
      dishName: dishName.trim() || recipeName.trim(),
      recipe: recipe.trim(),
      language: selectedLang,
    });
    router.push('/cook-mode');
  };

  const saveRecipe = async () => {
    if (!recipe.trim()) return;
    setSaving(true);
    const alerts = getSaveRecipeAlerts(selectedLang);
    try {
      const imageToStore = persistableImageUrl(imageUrl);
      const nextItem: StoredSavedRecipe = {
        id: makeShortRecipeId(),
        dishName,
        recipe,
        imageUrl: imageToStore,
        ingredient,
        cuisine: selectedCuisine,
        language: selectedLang,
        generationMode,
        dietPreference,
        spiceLevel,
        maxCaloriesPerMeal: maxCaloriesPerMeal != null ? String(maxCaloriesPerMeal) : '',
        servings: String(servings),
        difficultyLevel,
        cookTimeMinutes: cookTimeMinutes != null ? String(cookTimeMinutes) : '',
        nutritionCaloriesKcal: nutrition.caloriesKcal != null ? String(nutrition.caloriesKcal) : '',
        nutritionProteinG: nutrition.proteinG != null ? String(nutrition.proteinG) : '',
        nutritionCarbsG: nutrition.carbsG != null ? String(nutrition.carbsG) : '',
        savedAt: new Date().toISOString(),
      };
      await upsertSavedRecipe(nextItem);
      const usedDataImage = imageUrl.trim().startsWith('data:') && !imageToStore;
      Alert.alert(
        alerts.savedTitle,
        usedDataImage ? alerts.savedBodyNoImage : alerts.savedBody
      );
    } catch (e) {
      if (__DEV__ && e instanceof Error) {
        console.warn('saveRecipe failed:', e.message);
      }
      Alert.alert(alerts.failedTitle, alerts.failedBody);
    } finally {
      setSaving(false);
    }
  };

  const fetchRecipeDetailsFromBackend = useCallback(async () => {
    if (!API_BASE_URL) {
      throw new Error('EXPO_PUBLIC_API_BASE_URL সেট করা নেই। .env ফাইলে API URL দিন।');
    }

    let response: Response;
    try {
      response = await fetchWithTimeout(
        `${API_BASE_URL}/api/v1/ai/recipes/details`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            recipeName,
            query: ingredient,
            ingredient,
            cuisine: selectedCuisine,
            language: selectedLang,
            generationMode,
            dietPreference,
            spiceLevel,
            difficultyLevel,
            ...(cookTimeMinutes != null ? { cookTimeMinutes } : {}),
            ...(maxCaloriesPerMeal != null ? { maxCaloriesPerMeal } : {}),
            servings,
          }),
        },
        70000
      );
    } catch (error) {
      if (isAbortError(error)) {
        throw new Error('Recipe request timed out. Please try again.');
      }
      throw error;
    }

    if (!response.ok) {
      let message = `Backend request failed (${response.status})`;
      try {
        const errorJson = await response.json();
        if (typeof errorJson?.message === 'string') message = errorJson.message;
      } catch {
        // Ignore parsing error for non-json responses.
      }
      throw new Error(message);
    }

    const data = await response.json();
    const name = typeof data?.dishName === 'string' && data.dishName.trim() ? data.dishName.trim() : recipeName;
    const instructions = typeof data?.recipe === 'string' ? cleanRecipeText(data.recipe) : '';
    const generatedImageUrl = typeof data?.imageUrl === 'string' ? data.imageUrl : '';
    const nutritionEstimate = data?.nutritionEstimate && typeof data.nutritionEstimate === 'object'
      ? {
          caloriesKcal:
            typeof data.nutritionEstimate.caloriesKcal === 'number' ? Math.max(0, Math.round(data.nutritionEstimate.caloriesKcal)) : null,
          proteinG:
            typeof data.nutritionEstimate.proteinG === 'number' ? Math.max(0, Math.round(data.nutritionEstimate.proteinG)) : null,
          carbsG:
            typeof data.nutritionEstimate.carbsG === 'number' ? Math.max(0, Math.round(data.nutritionEstimate.carbsG)) : null,
        }
      : EMPTY_NUTRITION;

    if (!instructions) throw new Error('No recipe details returned from backend');
    return { name, instructions, generatedImageUrl, nutritionEstimate };
  }, [
    recipeName,
    ingredient,
    selectedCuisine,
    selectedLang,
    generationMode,
    dietPreference,
    spiceLevel,
    maxCaloriesPerMeal,
    servings,
    difficultyLevel,
    cookTimeMinutes,
  ]);

  useEffect(() => {
    const loadRecipe = async () => {
      const cacheKey = `${generationMode}__${dietPreference}__${spiceLevel}__${difficultyLevel}__${cookTimeMinutes ?? ''}__${maxCaloriesPerMeal ?? ''}__${servings}__${selectedCuisine}__${selectedLang}__${ingredient.trim().toLowerCase()}__${recipeName}`;

      setLoading(true);
      setErrorMessage('');
      setRecipe('');
      setImageUrl('');
      setNutrition(EMPTY_NUTRITION);
      setImageError(false);
      setImageFallbackTried(false);

      try {
        if (recipeId) {
          const localSaved = await getSavedRecipeById(recipeId);
          if (localSaved?.recipe?.trim()) {
            setDishName(localSaved.dishName || recipeName);
            setRecipe(localSaved.recipe);
            setImageUrl(localSaved.imageUrl || '');
            setNutrition({
              caloriesKcal: localSaved.nutritionCaloriesKcal ? Number.parseInt(localSaved.nutritionCaloriesKcal, 10) || null : null,
              proteinG: localSaved.nutritionProteinG ? Number.parseInt(localSaved.nutritionProteinG, 10) || null : null,
              carbsG: localSaved.nutritionCarbsG ? Number.parseInt(localSaved.nutritionCarbsG, 10) || null : null,
            });
            return;
          }
        }

        const { name, instructions, generatedImageUrl, nutritionEstimate } = await fetchRecipeDetailsFromBackend();

        setDishName(name);
        setRecipe(instructions);
        setImageUrl(generatedImageUrl);
        setNutrition(nutritionEstimate);
        await saveRecentView(name);
        recipeDetailsCache[cacheKey] = {
          dishName: name,
          recipe: instructions,
          imageUrl: generatedImageUrl,
          nutrition: nutritionEstimate,
        };
      } catch (error) {
        console.error(error);
        if (error instanceof Error) {
          setErrorMessage(error.message);
        } else {
          setErrorMessage('রেসিপি লোড করা যায়নি। দয়া করে আবার চেষ্টা করুন।');
        }
      } finally {
        setLoading(false);
      }
    };

    loadRecipe();
  }, [
    ingredient,
    recipeName,
    selectedCuisine,
    selectedLang,
    generationMode,
    dietPreference,
    spiceLevel,
    maxCaloriesPerMeal,
    servings,
    difficultyLevel,
    cookTimeMinutes,
    recipeId,
    fetchRecipeDetailsFromBackend,
    saveRecentView,
  ]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.page}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 28 + HOME_EXPLORE_NAV_RESERVED_BOTTOM }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Back to Recipe List</Text>
        </TouchableOpacity>
        <Text style={styles.summaryText}>
          Ingredient: {ingredient || 'N/A'}  |  Cuisine: {selectedCuisine}  |  Language: {selectedLang}  |  Mode:{' '}
          {generationMode}
          {'  |  '}
          Diet: {dietPreference}  |  Spice: {spiceLevel}
          {maxCaloriesPerMeal != null ? `  |  Max kcal: ${maxCaloriesPerMeal}` : ''}
          {`  |  Servings: ${servings}`}
          {`  |  Difficulty: ${difficultyLevel}`}
          {cookTimeMinutes != null ? `  |  Time: ${cookTimeMinutes} min` : ''}
        </Text>
        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.saveButton} onPress={saveRecipe} disabled={saving || loading || !recipe}>
            <Text style={styles.saveButtonText}>{saving ? 'Saving...' : 'Save Recipe'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.cookModeButton, (loading || !recipe) && styles.cookModeButtonDisabled]}
            onPress={openCookMode}
            disabled={loading || !recipe}
            accessibilityRole="button"
            accessibilityLabel="Cook mode">
            <Text style={styles.cookModeButtonText}>Cook mode</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.loaderWrap}>
            <ActivityIndicator size="large" color="#d3b275" />
            <Text style={styles.loaderText}>Recipe loading...</Text>
          </View>
        ) : (
          <>
            {imageUrl && !imageError ? (
              <Image
                source={{ uri: imageUrl }}
                style={styles.dishImage}
                onError={() => {
                  if (!imageFallbackTried) {
                    setImageFallbackTried(true);
                    setImageUrl(`https://placehold.co/1024x768/111111/d3b275?text=${encodeURIComponent(dishName || recipeName)}`);
                    return;
                  }
                  setImageError(true);
                  setImageUrl('');
                }}
              />
            ) : null}
            {imageUrl && imageError ? (
              <View style={[styles.dishImage, styles.imageFallback]}>
                <Text style={styles.imageFallbackText}>ছবি লোড হচ্ছে না</Text>
              </View>
            ) : null}
            {dishName ? <Text style={styles.dishTitle}>{dishName}</Text> : null}
            {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
            {(nutrition.caloriesKcal != null || nutrition.proteinG != null || nutrition.carbsG != null) ? (
              <View style={styles.nutritionCard}>
                <Text style={styles.nutritionTitle}>Estimated Nutrition (approx.)</Text>
                <Text style={styles.nutritionLine}>
                  Calories: {nutrition.caloriesKcal != null ? `${nutrition.caloriesKcal} kcal` : 'N/A'}  |  Protein:{' '}
                  {nutrition.proteinG != null ? `${nutrition.proteinG} g` : 'N/A'}  |  Carbs:{' '}
                  {nutrition.carbsG != null ? `${nutrition.carbsG} g` : 'N/A'}
                </Text>
              </View>
            ) : null}
            {recipe ? (
              <View style={styles.recipeCard}>
                <Text style={styles.recipeText}>{recipe}</Text>
              </View>
            ) : null}
          </>
        )}
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
    marginBottom: 18,
  },
  backButtonText: { color: '#d3b275', fontSize: 14, fontWeight: '600' },
  summaryText: { alignSelf: 'flex-start', color: '#9a9a9a', fontSize: 12, marginBottom: 14 },
  actionRow: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 14,
  },
  saveButton: {
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#444',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  saveButtonText: { color: '#d3b275', fontSize: 13, fontWeight: '600' },
  cookModeButton: {
    backgroundColor: '#d3b275',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#e8c989',
  },
  cookModeButtonDisabled: { opacity: 0.45 },
  cookModeButtonText: { color: '#000', fontSize: 13, fontWeight: '700' },
  loaderWrap: { alignItems: 'center', marginTop: 80 },
  loaderText: { color: '#d3b275', marginTop: 10, fontSize: 14 },
  dishImage: {
    width: '100%',
    height: 360,
    borderRadius: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#d3b275',
  },
  dishTitle: {
    color: '#d3b275',
    fontSize: 26,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
  },
  recipeCard: { width: '100%', backgroundColor: '#111', padding: 25, borderRadius: 20, marginBottom: 20 },
  recipeText: { color: '#ddd', fontSize: 16, lineHeight: 26 },
  nutritionCard: {
    width: '100%',
    backgroundColor: '#121212',
    borderWidth: 1,
    borderColor: '#2e2e2e',
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
  },
  nutritionTitle: { color: '#d3b275', fontSize: 13, fontWeight: '700', marginBottom: 6 },
  nutritionLine: { color: '#cfcfcf', fontSize: 13, lineHeight: 20 },
  errorText: { color: '#ff7f7f', fontSize: 14, marginBottom: 14, textAlign: 'center' },
  imageFallback: { justifyContent: 'center', alignItems: 'center', backgroundColor: '#111' },
  imageFallbackText: { color: '#d3b275', fontSize: 16, textAlign: 'center' },
});
