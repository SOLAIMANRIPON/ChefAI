import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;
// Locked timeout/retry policy for production stability.
const recipeDetailsCache: Record<string, { dishName: string; recipe: string; imageUrl: string }> = {};

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

export default function RecipeDetailsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    recipeName?: string;
    ingredient?: string;
    selectedCuisine?: string;
    selectedLang?: string;
  }>();

  const recipeName = params.recipeName ?? 'Recipe';
  const ingredient = params.ingredient ?? '';
  const selectedCuisine = params.selectedCuisine ?? 'Bangladeshi';
  const selectedLang = params.selectedLang ?? 'বাংলা';

  const [dishName, setDishName] = useState(recipeName);
  const [recipe, setRecipe] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [imageError, setImageError] = useState(false);
  const [imageFallbackTried, setImageFallbackTried] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  const fetchRecipeDetailsFromBackend = async () => {
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

    if (!instructions) throw new Error('No recipe details returned from backend');
    return { name, instructions, generatedImageUrl };
  };

  useEffect(() => {
    const loadRecipe = async () => {
      const cacheKey = `${selectedCuisine}__${selectedLang}__${ingredient.trim().toLowerCase()}__${recipeName}`;

      setLoading(true);
      setErrorMessage('');
      setRecipe('');
      setImageUrl('');
      setImageError(false);
      setImageFallbackTried(false);

      try {
        const { name, instructions, generatedImageUrl } = await fetchRecipeDetailsFromBackend();

        setDishName(name);
        setRecipe(instructions);
        setImageUrl(generatedImageUrl);
        recipeDetailsCache[cacheKey] = {
          dishName: name,
          recipe: instructions,
          imageUrl: generatedImageUrl,
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
  }, [ingredient, recipeName, selectedCuisine, selectedLang]);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Back to Recipe List</Text>
        </TouchableOpacity>
        <Text style={styles.summaryText}>
          Ingredient: {ingredient || 'N/A'}  |  Cuisine: {selectedCuisine}  |  Language: {selectedLang}
        </Text>

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
            {recipe ? (
              <View style={styles.recipeCard}>
                <Text style={styles.recipeText}>{recipe}</Text>
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
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
  errorText: { color: '#ff7f7f', fontSize: 14, marginBottom: 14, textAlign: 'center' },
  imageFallback: { justifyContent: 'center', alignItems: 'center', backgroundColor: '#111' },
  imageFallbackText: { color: '#d3b275', fontSize: 16, textAlign: 'center' },
});
