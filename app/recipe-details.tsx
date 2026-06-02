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
import {
  deriveStructuredFromText,
  getRecipeSectionLabels,
  joinStructuredRecipe,
  readStructuredRecipeFromPayload,
  type StructuredRecipe,
} from '@/lib/recipe-structured';
import {
  ensureLocalImageFileForGallery,
  ensureShareableRecipeImage,
  persistableHttpImageUrl,
  resolveRecipeCoverForSave,
} from '@/lib/resolve-recipe-cover-for-save';
import {
  CHEFAI_INSTALL_HEADER,
  getOrCreateChefAiInstallId,
  type RecipeBillingSnapshot,
} from '@/constants/chefai-billing';
import { estimatedUsdPerCredit, getPlayCreditPacks } from '@/constants/play-credit-packs';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  ToastAndroid,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;

/** `react-native-share` needs `file://` / `content://` URIs; bare cache paths may not attach correctly. */
function toShareableFileUrl(pathOrUri: string): string {
  const s = pathOrUri.trim();
  if (!s) return s;
  if (s.startsWith('file://') || s.startsWith('content://')) return s;
  return s.startsWith('/') ? `file://${s}` : `file:///${s}`;
}

const RECENT_VIEWS_STORAGE_KEY = 'chefai_recent_views_v1';
// Locked timeout/retry policy for production stability.
type NutritionEstimate = { caloriesKcal: number | null; proteinG: number | null; carbsG: number | null };
const EMPTY_NUTRITION: NutritionEstimate = { caloriesKcal: null, proteinG: null, carbsG: null };
const EMPTY_STRUCTURED: StructuredRecipe = { ingredients: [], steps: [], tips: [], yieldServings: null };
const recipeDetailsCache: Record<string, { dishName: string; recipe: string; imageUrl: string; nutrition: NutritionEstimate; structured: StructuredRecipe }> = {};

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

  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  const dietLabel = dietPreference === 'none' ? 'Any' : dietPreference === 'gluten_free' ? 'Gluten-free' : cap(dietPreference);
  const modeLabel = cap(generationMode);
  const spiceLabel = cap(spiceLevel);
  const difficultyLabel = cap(difficultyLevel);

  const [dishName, setDishName] = useState(recipeName);
  const [recipe, setRecipe] = useState('');
  const [structured, setStructured] = useState<StructuredRecipe>(EMPTY_STRUCTURED);
  const [imageUrl, setImageUrl] = useState('');
  const [imageError, setImageError] = useState(false);
  const [imageFallbackTried, setImageFallbackTried] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [nutrition, setNutrition] = useState<NutritionEstimate>(EMPTY_NUTRITION);
  const [installId, setInstallId] = useState<string | null>(null);
  const [billing, setBilling] = useState<RecipeBillingSnapshot | null>(null);
  const [buyCreditsLoading, setBuyCreditsLoading] = useState(false);
  const [awaitingPlanChoice, setAwaitingPlanChoice] = useState(false);
  const [savingGallery, setSavingGallery] = useState(false);
  const installIdRef = useRef<string | null>(null);

  const sectionLabels = getRecipeSectionLabels(selectedLang);

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
    if (!recipe.trim() && !structured.steps.length) return;
    await saveCookModeSession({
      dishName: dishName.trim() || recipeName.trim(),
      recipe: recipe.trim(),
      language: selectedLang,
      ...(structured.steps.length ? { steps: structured.steps } : {}),
      ...(structured.ingredients.length ? { ingredients: structured.ingredients } : {}),
    });
    router.push('/cook-mode');
  };

  const onShareRecipe = useCallback(async () => {
    if (!recipe.trim() && !structured.steps.length) return;
    const title = (dishName.trim() || recipeName.trim() || 'Recipe').trim();
    const metaLine = [
      ingredient.trim() ? `Ingredients: ${ingredient.trim()}` : null,
      `Cuisine: ${selectedCuisine}`,
      `Language: ${selectedLang}`,
    ]
      .filter(Boolean)
      .join(' · ');
    const body =
      structured.steps.length || structured.ingredients.length
        ? joinStructuredRecipe(structured, selectedLang)
        : recipe.trim();
    const maxBody = 12000;
    const clipped = body.length > maxBody ? `${body.slice(0, maxBody)}\n…` : body;
    const message = `${title}\n${metaLine}\n\n${clipped}\n\n— ChefAI`;
    const payload: { title: string; message: string; url?: string } = { title, message };
    const webImage = persistableHttpImageUrl(imageUrl);
    if (Platform.OS === 'ios' && webImage) {
      payload.url = webImage;
    }

    const shareTextOnly = async () => {
      try {
        await Share.share(payload);
      } catch {
        /* user dismissed share sheet */
      }
    };

    if (Platform.OS === 'web') {
      await shareTextOnly();
      return;
    }

    let localImage: string | null = null;
    const rawImg = imageUrl.trim();
    if (rawImg) {
      try {
        localImage = await ensureShareableRecipeImage(rawImg);
      } catch {
        localImage = null;
      }
    }

    if (localImage) {
      const imgForShare = toShareableFileUrl(localImage);
      const ext = localImage.replace(/^file:\/\//, '').split('.').pop()?.toLowerCase() ?? '';
      const mimeType =
        ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
      const UTI =
        mimeType === 'image/png'
          ? 'public.png'
          : mimeType === 'image/webp'
            ? 'public.webp'
            : 'public.jpeg';

      try {
        const Clipboard = await import('expo-clipboard');
        await Clipboard.setStringAsync(message);
      } catch {
        // Clipboard is a fallback if a target app drops text.
      }

      const RNShare = (await import('react-native-share')).default;

      const shareImageWithTextSingleIntent = () =>
        RNShare.open({
          title,
          message,
          url: imgForShare,
          type: mimeType,
          failOnCancel: false,
        });

      const fallbackExpoImage = async () => {
        let Sharing: typeof import('expo-sharing');
        try {
          Sharing = await import('expo-sharing');
        } catch {
          await shareTextOnly();
          return;
        }
        if (!(await Sharing.isAvailableAsync())) {
          await shareTextOnly();
          return;
        }
        try {
          const Clipboard = await import('expo-clipboard');
          await Clipboard.setStringAsync(message);
        } catch {
          /* optional */
        }
        try {
          await Sharing.shareAsync(localImage, {
            mimeType,
            ...(Platform.OS === 'ios' ? { UTI } : {}),
            dialogTitle: 'Share photo — recipe is on your clipboard; paste in Messenger if the app only took the image',
          });
          if (Platform.OS === 'android') {
            ToastAndroid.show(
              'Full recipe is on your clipboard — paste in the chat if only the photo was sent.',
              ToastAndroid.LONG
            );
          }
        } catch {
          /* dismissed share sheet */
        }
      };

      // One chooser, one destination: text + image in one intent (Facebook/Messenger often keep both).
      // WhatsApp may still drop the text; full recipe stays on the clipboard — paste in the chat if needed.
      try {
        await shareImageWithTextSingleIntent();
      } catch {
        await fallbackExpoImage();
      }
      return;
    }

    await shareTextOnly();
  }, [
    dishName,
    recipeName,
    recipe,
    structured,
    selectedLang,
    ingredient,
    selectedCuisine,
    imageUrl,
  ]);

  const onSaveDishPhotoToGallery = useCallback(async () => {
    if (Platform.OS === 'web') {
      Alert.alert('Photos', 'Use the mobile app to save the dish photo to your gallery.');
      return;
    }
    const raw = imageUrl.trim();
    if (!raw) return;
    setSavingGallery(true);
    try {
      let requestPermissionsAsync: typeof import('expo-media-library').requestPermissionsAsync;
      let saveToLibraryAsync: typeof import('expo-media-library').saveToLibraryAsync;
      try {
        const mod = await import('expo-media-library');
        requestPermissionsAsync = mod.requestPermissionsAsync;
        saveToLibraryAsync = mod.saveToLibraryAsync;
      } catch {
        Alert.alert(
          'Update app build',
          'Saving to the gallery needs a dev client built with expo-media-library. Stop Metro, run: npx expo run:android (or run:ios), then open the new build.'
        );
        return;
      }
      const perm = await requestPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permission needed', 'Allow photo library access to save this image.');
        return;
      }
      const local = await ensureLocalImageFileForGallery(raw);
      if (!local) {
        Alert.alert(
          'Could not save',
          'Only generated or on-device photos can be saved to the gallery from here.'
        );
        return;
      }
      await saveToLibraryAsync(local);
      Alert.alert('Saved', 'Photo saved to your gallery. You can attach it when you share.');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Try again.';
      Alert.alert('Could not save', msg);
    } finally {
      setSavingGallery(false);
    }
  }, [imageUrl]);

  const trimmedImageUrl = imageUrl.trim();
  const canSaveDishPhotoToGallery =
    Platform.OS !== 'web' &&
    Boolean(trimmedImageUrl) &&
    (trimmedImageUrl.startsWith('data:') ||
      trimmedImageUrl.startsWith('file://') ||
      trimmedImageUrl.startsWith('content://') ||
      trimmedImageUrl.startsWith('ph://'));

  const saveRecipe = async () => {
    if (!recipe.trim() && !structured.steps.length) return;
    setSaving(true);
    const alerts = getSaveRecipeAlerts(selectedLang);
    try {
      const recipeId = makeShortRecipeId();
      const rawImage = imageUrl.trim();
      const imageToStore = await resolveRecipeCoverForSave(rawImage, recipeId);
      const expectsCopiedLocal =
        rawImage.length > 0 &&
        !rawImage.startsWith('data:') &&
        !persistableHttpImageUrl(rawImage);
      if (expectsCopiedLocal && !imageToStore) {
        Alert.alert(alerts.failedTitle, alerts.coverCopyFailedBody);
        return;
      }
      const nextItem: StoredSavedRecipe = {
        id: recipeId,
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
        ...(structured.ingredients.length ? { ingredientsList: structured.ingredients } : {}),
        ...(structured.steps.length ? { steps: structured.steps } : {}),
        ...(structured.tips.length ? { tips: structured.tips } : {}),
        ...(structured.yieldServings != null ? { yieldServings: String(structured.yieldServings) } : {}),
        savedAt: new Date().toISOString(),
      };
      await upsertSavedRecipe(nextItem);
      const usedDataImage = rawImage.startsWith('data:') && !imageToStore;
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

  const fetchRecipeBillingSnapshot = useCallback(async (deviceInstallId: string) => {
    if (!API_BASE_URL) return;
    const response = await fetchWithTimeout(
      `${API_BASE_URL}/api/v1/billing/state`,
      { headers: { [CHEFAI_INSTALL_HEADER]: deviceInstallId } },
      20000
    );
    if (!response.ok) {
      throw new Error(`Billing request failed (${response.status})`);
    }
    const data = await response.json();
    setBilling(data as RecipeBillingSnapshot);
  }, []);

  const fetchRecipeDetailsFromBackend = useCallback(
    async (deviceInstallId: string, includeImage: boolean) => {
    if (!API_BASE_URL) {
      throw new Error('EXPO_PUBLIC_API_BASE_URL সেট করা নেই। .env ফাইলে API URL দিন।');
    }

    let response: Response;
    try {
      response = await fetchWithTimeout(
        `${API_BASE_URL}/api/v1/ai/recipes/details`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            [CHEFAI_INSTALL_HEADER]: deviceInstallId,
          },
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
            includeImage,
          }),
        },
        // Server may take up to ~135s in the worst case (2 Gemini attempts at
        // 60s + 75s) plus image generation. 150s leaves a small buffer.
        150000
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
        if (response.status === 403 && typeof errorJson?.credits === 'number') {
          setBilling(errorJson as RecipeBillingSnapshot);
        }
      } catch {
        // Ignore parsing error for non-json responses.
      }
      throw new Error(message);
    }

    const data = await response.json();
    if (data?.billing && typeof data.billing === 'object') {
      setBilling(data.billing as RecipeBillingSnapshot);
    }
    if (data?.degraded === true) {
      const degradedMessage =
        typeof data?.message === 'string' && data.message.trim()
          ? data.message
          : 'Recipe generator is temporarily unavailable. Please try again.';
      throw new Error(degradedMessage);
    }
    const name = typeof data?.dishName === 'string' && data.dishName.trim() ? data.dishName.trim() : recipeName;

    // Structured-first: read arrays from the new contract. If missing (older
    // server / fallback path), derive from the legacy `recipe` text.
    let structuredFromBackend = readStructuredRecipeFromPayload(data);
    if (!structuredFromBackend.steps.length && typeof data?.recipe === 'string') {
      structuredFromBackend = deriveStructuredFromText(data.recipe);
    }
    const instructions = typeof data?.recipe === 'string' && data.recipe.trim()
      ? cleanRecipeText(data.recipe)
      : joinStructuredRecipe(structuredFromBackend, selectedLang);

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

    if (!instructions && !structuredFromBackend.steps.length) {
      throw new Error('No recipe details returned from backend');
    }
    return { name, instructions, structured: structuredFromBackend, generatedImageUrl, nutritionEstimate };
  },
    [
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
    ]
  );

  const runRecipeGeneration = useCallback(
    async (includeImage: boolean) => {
      const deviceId = installIdRef.current;
      if (!deviceId) return;
      const cacheKey = `${generationMode}__${dietPreference}__${spiceLevel}__${difficultyLevel}__${cookTimeMinutes ?? ''}__${maxCaloriesPerMeal ?? ''}__${servings}__${selectedCuisine}__${selectedLang}__${ingredient.trim().toLowerCase()}__${recipeName}__img:${includeImage}`;

      setAwaitingPlanChoice(false);
      setLoading(true);
      setErrorMessage('');
      setRecipe('');
      setStructured(EMPTY_STRUCTURED);
      setImageUrl('');
      setNutrition(EMPTY_NUTRITION);
      setImageError(false);
      setImageFallbackTried(false);

      try {
        const { name, instructions, structured: backendStructured, generatedImageUrl, nutritionEstimate } =
          await fetchRecipeDetailsFromBackend(deviceId, includeImage);

        setDishName(name);
        setStructured(backendStructured);
        setRecipe(instructions);
        setImageUrl(generatedImageUrl);
        setNutrition(nutritionEstimate);
        await saveRecentView(name);
        recipeDetailsCache[cacheKey] = {
          dishName: name,
          recipe: instructions,
          imageUrl: generatedImageUrl,
          nutrition: nutritionEstimate,
          structured: backendStructured,
        };
      } catch (error) {
        console.error(error);
        if (error instanceof Error) {
          setErrorMessage(error.message);
        } else {
          setErrorMessage('রেসিপি লোড করা যায়নি। দয়া করে আবার চেষ্টা করুন।');
        }
        setAwaitingPlanChoice(true);
      } finally {
        setLoading(false);
      }
    },
    [
      cookTimeMinutes,
      difficultyLevel,
      dietPreference,
      fetchRecipeDetailsFromBackend,
      generationMode,
      ingredient,
      maxCaloriesPerMeal,
      recipeName,
      saveRecentView,
      selectedCuisine,
      selectedLang,
      servings,
      spiceLevel,
    ]
  );

  useEffect(() => {
    const loadRecipe = async () => {
      setLoading(true);
      setErrorMessage('');
      setRecipe('');
      setStructured(EMPTY_STRUCTURED);
      setImageUrl('');
      setNutrition(EMPTY_NUTRITION);
      setImageError(false);
      setImageFallbackTried(false);
      setAwaitingPlanChoice(false);

      try {
        if (recipeId) {
          const localSaved = await getSavedRecipeById(recipeId);
          if (localSaved?.recipe?.trim() || (localSaved?.steps && localSaved.steps.length)) {
            const yieldFromSaved =
              localSaved.yieldServings && Number.isFinite(Number.parseInt(localSaved.yieldServings, 10))
                ? Number.parseInt(localSaved.yieldServings, 10)
                : null;
            const savedStructured: StructuredRecipe = {
              ingredients: localSaved.ingredientsList ?? [],
              steps: localSaved.steps ?? [],
              tips: localSaved.tips ?? [],
              yieldServings: yieldFromSaved,
            };
            const finalStructured = savedStructured.steps.length
              ? savedStructured
              : deriveStructuredFromText(localSaved.recipe);
            setDishName(localSaved.dishName || recipeName);
            setStructured(finalStructured);
            setRecipe(localSaved.recipe || joinStructuredRecipe(finalStructured, selectedLang));
            setImageUrl(localSaved.imageUrl || '');
            setNutrition({
              caloriesKcal: localSaved.nutritionCaloriesKcal ? Number.parseInt(localSaved.nutritionCaloriesKcal, 10) || null : null,
              proteinG: localSaved.nutritionProteinG ? Number.parseInt(localSaved.nutritionProteinG, 10) || null : null,
              carbsG: localSaved.nutritionCarbsG ? Number.parseInt(localSaved.nutritionCarbsG, 10) || null : null,
            });
            return;
          }
        }

        if (!API_BASE_URL) {
          throw new Error('EXPO_PUBLIC_API_BASE_URL সেট করা নেই। .env ফাইলে API URL দিন।');
        }

        const id = await getOrCreateChefAiInstallId();
        installIdRef.current = id;
        setInstallId(id);
        await fetchRecipeBillingSnapshot(id);
        setAwaitingPlanChoice(true);
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
    recipeId,
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
    fetchRecipeBillingSnapshot,
  ]);

  const onChooseTextPlan = useCallback(() => {
    void runRecipeGeneration(false);
  }, [runRecipeGeneration]);

  const onChoosePhotoPlan = useCallback(() => {
    void runRecipeGeneration(true);
  }, [runRecipeGeneration]);

  const runCreditPackPurchase = useCallback(
    async (productSku: string) => {
      if (!installId || !API_BASE_URL || !billing || billing.billingDisabled) return;
      setBuyCreditsLoading(true);
      try {
        const { purchaseCreditsWithGooglePlay } = await import('@/lib/buy-credits-play');
        const next = await purchaseCreditsWithGooglePlay({
          apiBaseUrl: API_BASE_URL,
          installId,
          productSku,
        });
        setBilling(next);
        Alert.alert('Buy credits', `Your balance is now ${next.credits} credits.`, [{ text: 'OK' }]);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Purchase did not complete.';
        Alert.alert('Buy credits', message, [{ text: 'OK' }]);
      } finally {
        setBuyCreditsLoading(false);
      }
    },
    [billing, installId]
  );

  const onBuyCreditsPress = useCallback(() => {
    if (!installId || !API_BASE_URL || !billing || billing.billingDisabled) return;

    if (Platform.OS !== 'android') {
      Alert.alert(
        'Buy credits',
        'Google Play purchases run on Android. Install the Android app from Play (or your dev client) to buy credits.',
        [{ text: 'OK' }]
      );
      return;
    }

    const packs = getPlayCreditPacks();
    if (packs.length === 0) {
      Alert.alert('Buy credits', 'No credit packs are configured.', [{ text: 'OK' }]);
      return;
    }

    Alert.alert(
      'Choose a credit pack',
      'Prices are set in Google Play (USD). New installs start with 15 free credits.',
      [
        ...packs.map((pack) => ({
          text: `${pack.title} — ${pack.credits} credits (~$${pack.suggestedUsd.toFixed(2)})`,
          onPress: () => void runCreditPackPurchase(pack.productId),
        })),
        { text: 'Cancel', style: 'cancel' as const },
      ]
    );
  }, [billing, installId, runCreditPackPurchase]);

  const onYourCreditsPress = useCallback(() => {
    if (!billing) return;
    Alert.alert(
      'Your credits',
      `Balance: ${billing.credits} credits.\nText recipe: ${billing.creditCostTextRecipe ?? 1} credit each.\nPhoto recipe: ${billing.creditCostPhotoRecipe ?? 3} credits each.`,
      [{ text: 'OK' }]
    );
  }, [billing]);

  const usdPerCredit = estimatedUsdPerCredit();
  const textUsdHint = usdPerCredit.toFixed(2);
  const photoUsdHint = (usdPerCredit * 3).toFixed(2);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.page}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 28 + HOME_EXPLORE_NAV_RESERVED_BOTTOM }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Back to Recipe List</Text>
        </TouchableOpacity>
        <Text style={styles.summaryText}>
          Ingredient: {ingredient || 'N/A'}  |  Cuisine: {selectedCuisine}  |  Language: {selectedLang}  |  Mode:{' '}
          {modeLabel}
          {'  |  '}
          Diet: {dietLabel}  |  Spice: {spiceLabel}
          {maxCaloriesPerMeal != null ? `  |  Max kcal: ${maxCaloriesPerMeal}` : ''}
          {`  |  Servings: ${servings}`}
          {`  |  Difficulty: ${difficultyLabel}`}
          {cookTimeMinutes != null ? `  |  Time: ${cookTimeMinutes} min` : ''}
        </Text>
        {awaitingPlanChoice ? (
          <Text style={[styles.dishTitle, styles.planGateDishTitle]} accessibilityRole="header">
            {(recipeName.trim() || dishName).trim() || 'Recipe'}
          </Text>
        ) : null}
        {awaitingPlanChoice && installId && billing ? (
          <View style={styles.planChoiceCard}>
            <Text style={styles.planChoiceTitle}>Choose how to generate</Text>
            <Text style={styles.planChoiceHint}>
              Text recipe uses 1 credit (~USD {textUsdHint}). Photo recipe uses 3 credits (~USD {photoUsdHint}). When
              credits reach 0, tap Buy credits — Small / Medium / Large packs on Google Play.
            </Text>
            <TouchableOpacity
              style={styles.planOption}
              onPress={onChooseTextPlan}
              accessibilityRole="button"
              accessibilityHint={`Costs ${billing.creditCostTextRecipe ?? 1} credit, about USD ${textUsdHint}`}>
              <Text style={styles.planOptionTitle}>Text recipe only</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.planOption}
              onPress={onChoosePhotoPlan}
              accessibilityRole="button"
              accessibilityHint={`Costs ${billing.creditCostPhotoRecipe ?? 3} credits, about USD ${photoUsdHint}`}>
              <Text style={styles.planOptionTitle}>Recipe with photo</Text>
            </TouchableOpacity>
            <View style={styles.planFooterButtons}>
              <TouchableOpacity
                style={styles.planFooterButton}
                onPress={onYourCreditsPress}
                accessibilityRole="button"
                accessibilityLabel={`Your credits, balance ${billing.credits}`}>
                <Text style={styles.planFooterButtonLabel}>Your credits</Text>
                <Text style={styles.planFooterButtonValue}>{billing.credits}</Text>
              </TouchableOpacity>
              {!billing.billingDisabled ? (
                <TouchableOpacity
                  style={[styles.planFooterButton, styles.planFooterButtonCompact]}
                  onPress={() => void onBuyCreditsPress()}
                  accessibilityRole="button"
                  disabled={buyCreditsLoading}>
                  {buyCreditsLoading ? (
                    <ActivityIndicator color="#d3b275" size="small" />
                  ) : (
                    <Text style={styles.planFooterButtonLabel}>Buy credits</Text>
                  )}
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        ) : null}
        {awaitingPlanChoice && errorMessage ? (
          <Text style={[styles.errorText, { alignSelf: 'stretch', marginBottom: 12 }]}>{errorMessage}</Text>
        ) : null}
        {!awaitingPlanChoice ? (
          <>
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={styles.saveButton}
                onPress={saveRecipe}
                disabled={saving || loading || !recipe}>
                <Text style={styles.saveButtonText}>{saving ? 'Saving…' : 'Save Recipe'}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.cookModeButton,
                  (loading || !recipe) && styles.cookModeButtonDisabled,
                ]}
                onPress={openCookMode}
                disabled={loading || !recipe}
                accessibilityRole="button"
                accessibilityLabel="Cook Mode">
                <Text style={styles.cookModeButtonText}>Cook Mode</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={[
                styles.shareRecipeButton,
                (loading || (!recipe.trim() && !structured.steps.length)) && styles.shareRecipeButtonDisabled,
              ]}
              onPress={() => void onShareRecipe()}
              disabled={loading || (!recipe.trim() && !structured.steps.length)}
              accessibilityRole="button"
              accessibilityLabel="Share recipe to social apps">
              <Text style={styles.shareRecipeButtonText}>Share recipe</Text>
              <Text style={styles.shareRecipeHint}>WhatsApp, Facebook, Messages…</Text>
            </TouchableOpacity>
            {canSaveDishPhotoToGallery ? (
              <TouchableOpacity
                style={[styles.galleryButton, (loading || savingGallery) && styles.galleryButtonDisabled]}
                onPress={() => void onSaveDishPhotoToGallery()}
                disabled={loading || savingGallery}
                accessibilityRole="button"
                accessibilityLabel="Save dish photo to device gallery">
                <Text style={styles.galleryButtonText}>
                  {savingGallery ? 'Saving…' : 'Save photo to gallery'}
                </Text>
              </TouchableOpacity>
            ) : null}
          </>
        ) : null}

        {loading ? (
          <View style={styles.loaderWrap}>
            <ActivityIndicator size="large" color="#d3b275" />
            <Text style={styles.loaderText}>Recipe loading...</Text>
          </View>
        ) : awaitingPlanChoice ? null : (
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
            {structured.steps.length || structured.ingredients.length || structured.tips.length ? (
              <View style={styles.recipeCard}>
                {structured.yieldServings != null ? (
                  <Text style={styles.yieldText}>
                    {sectionLabels.yieldsLabel}: {structured.yieldServings} {sectionLabels.servingsLabel}
                  </Text>
                ) : null}

                {structured.ingredients.length ? (
                  <>
                    <Text style={styles.sectionHeading}>{sectionLabels.ingredients}</Text>
                    <View style={styles.bulletGroup}>
                      {structured.ingredients.map((item, i) => (
                        <View key={`ing-${i}`} style={styles.bulletRow}>
                          <Text style={styles.bulletDot}>•</Text>
                          <Text style={styles.bulletText}>{item}</Text>
                        </View>
                      ))}
                    </View>
                  </>
                ) : null}

                {structured.steps.length ? (
                  <>
                    <Text style={styles.sectionHeading}>{sectionLabels.instructions}</Text>
                    <View style={styles.bulletGroup}>
                      {structured.steps.map((step, i) => (
                        <View key={`step-${i}`} style={styles.bulletRow}>
                          <Text style={styles.stepNumber}>{i + 1}.</Text>
                          <Text style={styles.bulletText}>{step}</Text>
                        </View>
                      ))}
                    </View>
                  </>
                ) : null}

                {structured.tips.length ? (
                  <>
                    <Text style={styles.sectionHeading}>{sectionLabels.tips}</Text>
                    <View style={styles.bulletGroup}>
                      {structured.tips.map((tip, i) => (
                        <View key={`tip-${i}`} style={styles.bulletRow}>
                          <Text style={styles.bulletDot}>•</Text>
                          <Text style={styles.bulletText}>{tip}</Text>
                        </View>
                      ))}
                    </View>
                  </>
                ) : null}
              </View>
            ) : recipe ? (
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
  planChoiceCard: {
    width: '100%',
    backgroundColor: '#121212',
    borderWidth: 1,
    borderColor: '#2e2e2e',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    gap: 12,
  },
  planChoiceTitle: {
    color: '#d3b275',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  planChoiceHint: {
    color: '#888',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 17,
    marginBottom: 4,
  },
  planOption: {
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  planOptionTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    alignSelf: 'stretch',
  },
  planFooterButtons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
    alignSelf: 'stretch',
  },
  planFooterButton: {
    flex: 1,
    backgroundColor: '#000',
    borderWidth: 1,
    borderColor: '#555',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  planFooterButtonCompact: {
    paddingVertical: 14,
  },
  planFooterButtonLabel: { color: '#d3b275', fontSize: 14, fontWeight: '600', textAlign: 'center' },
  planFooterButtonValue: {
    color: '#e8e8e8',
    fontSize: 20,
    fontWeight: '700',
    marginTop: 4,
    textAlign: 'center',
  },
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
  shareRecipeButton: {
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#d3b275',
    backgroundColor: '#141008',
  },
  shareRecipeButtonDisabled: { opacity: 0.45 },
  shareRecipeButtonText: { color: '#d3b275', fontSize: 14, fontWeight: '700' },
  shareRecipeHint: { color: '#777', fontSize: 11, marginTop: 4, textAlign: 'center' },
  galleryButton: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#555',
    backgroundColor: '#111',
  },
  galleryButtonDisabled: { opacity: 0.45 },
  galleryButtonText: { color: '#c9c9c9', fontSize: 13, fontWeight: '600' },
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
  planGateDishTitle: {
    alignSelf: 'stretch',
    marginTop: 4,
  },
  recipeCard: { width: '100%', backgroundColor: '#111', padding: 25, borderRadius: 20, marginBottom: 20 },
  recipeText: { color: '#ddd', fontSize: 16, lineHeight: 26 },
  yieldText: { color: '#9a9a9a', fontSize: 13, marginBottom: 12 },
  sectionHeading: {
    color: '#d3b275',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginTop: 14,
    marginBottom: 10,
  },
  bulletGroup: { gap: 8 },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  bulletDot: { color: '#d3b275', fontSize: 16, lineHeight: 24, width: 18 },
  stepNumber: {
    color: '#d3b275',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 24,
    width: 24,
  },
  bulletText: { flex: 1, color: '#ddd', fontSize: 15, lineHeight: 24 },
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
