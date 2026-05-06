import AsyncStorage from '@react-native-async-storage/async-storage';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { DesignerCreditLine } from '@/components/designer-footer';
import { DEFAULT_CUISINE, DEFAULT_UI_LANGUAGE } from '@/constants/app-defaults';
import {
  type DietConflictReason,
  analyzeDietInputConflict,
} from '@/constants/diet-input-conflict';
import { languageAliasByCountry } from '@/constants/language-alias';
import {
  type DifficultyLevel,
  type DietPreference,
  type SpiceLevel,
  normalizeDifficultyLevel,
  parseCookTimeMinutesParam,
  parseMaxCaloriesParam,
  parseServingsParam,
} from '@/constants/recipe-preferences';

const DAILY_FREE_LIMIT = 5;
const DAILY_USAGE_STORAGE_KEY = 'chefai_daily_usage_v1';
const RECENT_SEARCHES_STORAGE_KEY = 'chefai_recent_searches_v1';
const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;
const RECIPE_LIST_FETCH_MS = 60000;

export type GenerationMode = 'strict' | 'creative';

function paramString(v: string | string[] | undefined): string | undefined {
  if (v == null) return undefined;
  const s = Array.isArray(v) ? v[0] : v;
  const t = typeof s === 'string' ? s.trim() : '';
  return t || undefined;
}

function cleanIngredientInput(raw: string): string {
  return raw
    .replace(/\b(কমা|comma)\b/gi, ' ')
    .replace(/\b(ডট|dot|full\s*stop|period)\b/gi, ' ')
    .replace(/\b(semicolon|semi\s*colon|সেমিকোলন)\b/gi, ' ')
    .replace(/\b(colon|কোলন)\b/gi, ' ')
    .replace(/\b(and|এন্ড|ও)\b/gi, ' ')
    .replace(/\b(new\s*line|নিউ\s*লাইন)\b/gi, ' ')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[()[\]{}]/g, ' ')
    .replace(/[\s,;|/]+/g, ' ')
    .replace(/[.!?]{2,}/g, '.')
    .replace(/^[\s.,;:!?'"-]+|[\s.,;:!?'"-]+$/g, '')
    .trim();
}

const uiTranslations: Record<
  string,
  {
    freeRemainingLabel: string;
    ingredientPlaceholder: string;
    freeLimitEnded: string;
    modeSectionLabel: string;
    strictModeLabel: string;
    creativeModeLabel: string;
  }
> = {
  বাংলা: {
    freeRemainingLabel: 'আজ ফ্রি বাকি',
    ingredientPlaceholder: 'উপকরণের নাম অথবা খাবারের নাম লিখুন...',
    freeLimitEnded: 'আজকের ৫টি ফ্রি রিকোয়েস্ট শেষ। আরও ব্যবহার করতে ক্রেডিট/সাবস্ক্রিপশন নিন।',
    modeSectionLabel: 'রেসিপি মোড',
    strictModeLabel: 'নির্ভুল',
    creativeModeLabel: 'সৃজনশীল',
  },
  English: {
    freeRemainingLabel: 'Free left today',
    ingredientPlaceholder: 'Enter ingredient or dish name...',
    freeLimitEnded: 'Today\'s 5 free requests are used up. Buy credits or subscribe to continue.',
    modeSectionLabel: 'Recipe mode',
    strictModeLabel: 'Strict',
    creativeModeLabel: 'Creative',
  },
  Hindi: {
    freeRemainingLabel: 'आज फ्री बाकी',
    ingredientPlaceholder: 'सामग्री या डिश का नाम लिखें...',
    freeLimitEnded: 'आज की 5 फ्री रिक्वेस्ट खत्म हो गई हैं। आगे बढ़ने के लिए क्रेडिट या सब्सक्रिप्शन लें।',
    modeSectionLabel: 'रेसिपी मोड',
    strictModeLabel: 'सटीक',
    creativeModeLabel: 'रचनात्मक',
  },
  Arabic: {
    freeRemainingLabel: 'المتبقي المجاني اليوم',
    ingredientPlaceholder: 'اكتب اسم المكون او اسم الطبق...',
    freeLimitEnded: 'انتهت 5 طلباتك المجانية لليوم. اشترِ رصيدًا أو اشترك للمتابعة.',
    modeSectionLabel: 'وضع الوصفة',
    strictModeLabel: 'دقيق',
    creativeModeLabel: 'إبداعي',
  },
  French: {
    freeRemainingLabel: 'Gratuit restant aujourd\'hui',
    ingredientPlaceholder: 'Entrez le nom d\'un ingredient ou d\'un plat...',
    freeLimitEnded: 'Vos 5 requetes gratuites du jour sont terminees. Achetez des credits ou abonnez-vous.',
    modeSectionLabel: 'Mode recette',
    strictModeLabel: 'Precis',
    creativeModeLabel: 'Creatif',
  },
  Spanish: {
    freeRemainingLabel: 'Gratis restante hoy',
    ingredientPlaceholder: 'Escribe el nombre del ingrediente o del plato...',
    freeLimitEnded: 'Tus 5 solicitudes gratis de hoy se han agotado. Compra creditos o suscribete para continuar.',
    modeSectionLabel: 'Modo receta',
    strictModeLabel: 'Estricto',
    creativeModeLabel: 'Creativo',
  },
  Urdu: {
    freeRemainingLabel: 'آج فری باقی',
    ingredientPlaceholder: 'اجزاء کا نام یا کھانے کا نام لکھیں...',
    freeLimitEnded: 'آج کی 5 فری درخواستیں ختم ہو چکی ہیں۔ مزید کے لیے کریڈٹ خریدیں یا سبسکرائب کریں۔',
    modeSectionLabel: 'ریسیپی موڈ',
    strictModeLabel: 'درست',
    creativeModeLabel: 'تخلیقی',
  },
  Japanese: {
    freeRemainingLabel: '本日の無料残り',
    ingredientPlaceholder: '材料名または料理名を入力してください...',
    freeLimitEnded: '本日の無料5回分は終了しました。続行するにはクレジット購入または登録してください。',
    modeSectionLabel: 'レシピモード',
    strictModeLabel: '厳密',
    creativeModeLabel: 'クリエイティブ',
  },
  Chinese: {
    freeRemainingLabel: '今日剩余免费次数',
    ingredientPlaceholder: '请输入食材名称或菜名...',
    freeLimitEnded: '今天的5次免费请求已用完。请购买额度或订阅继续使用。',
    modeSectionLabel: '食谱模式',
    strictModeLabel: '严谨',
    creativeModeLabel: '创意',
  },
  Korean: {
    freeRemainingLabel: '오늘 남은 무료 횟수',
    ingredientPlaceholder: '재료 이름 또는 음식 이름을 입력하세요...',
    freeLimitEnded: '오늘의 무료 5회 요청을 모두 사용했습니다. 계속하려면 크레딧 구매 또는 구독이 필요합니다.',
    modeSectionLabel: '레시피 모드',
    strictModeLabel: '정확',
    creativeModeLabel: '창의',
  },
  Turkish: {
    freeRemainingLabel: 'Bugun kalan ucretsiz hak',
    ingredientPlaceholder: 'Malzeme veya yemek adini yazin...',
    freeLimitEnded: 'Bugunku 5 ucretsiz istek doldu. Devam etmek icin kredi satin alin veya abone olun.',
    modeSectionLabel: 'Tarif modu',
    strictModeLabel: 'Kesin',
    creativeModeLabel: 'Yaratici',
  },
  Persian: {
    freeRemainingLabel: 'باقی مانده رایگان امروز',
    ingredientPlaceholder: 'نام ماده يا نام غذا را وارد کنيد...',
    freeLimitEnded: '۵ درخواست رايگان امروز تمام شده است. براي ادامه اعتبار خريداري کنيد يا اشتراک بگيريد.',
    modeSectionLabel: 'حالت دستور',
    strictModeLabel: 'دقیق',
    creativeModeLabel: 'خلاقانه',
  },
  Portuguese: {
    freeRemainingLabel: 'Gratis restante hoje',
    ingredientPlaceholder: 'Digite o nome do ingrediente ou do prato...',
    freeLimitEnded: 'As 5 solicitacoes gratis de hoje acabaram. Compre creditos ou assine para continuar.',
    modeSectionLabel: 'Modo receita',
    strictModeLabel: 'Rigoroso',
    creativeModeLabel: 'Criativo',
  },
  Greek: {
    freeRemainingLabel: 'Δωρεαν υπολοιπο σημερα',
    ingredientPlaceholder: 'Γραψτε ονομα υλικου ή φαγητου...',
    freeLimitEnded: 'Οι 5 δωρεαν αιτησεις της ημερας τελειωσαν. Αγοραστε πιστωσεις ή κανετε συνδρομη.',
    modeSectionLabel: 'Λειτουργια συνταγης',
    strictModeLabel: 'Ακριβης',
    creativeModeLabel: 'Δημιουργικο',
  },
};

const dietSpiceUi = {
  বাংলা: {
    dietSectionLabel: 'ডায়েট',
    dietNone: 'সব',
    dietVegetarian: 'নিরামিষ',
    dietVegan: 'ভেগান',
    dietGlutenFree: 'গ্লুটেন-ফ্রি',
    spiceSectionLabel: 'ঝালের মাত্রা',
    spiceMild: 'হালকা',
    spiceMedium: 'মাঝারি',
    spiceHot: 'ঝাল',
    caloriesSectionLabel: 'সর্বোচ্চ ক্যালরি / বেলা (ঐচ্ছিক)',
    caloriesPlaceholder: 'যেমন ৬০০ — খালি রাখলে লিমিট নেই',
    servingsSectionLabel: 'কত জনের জন্য (পোর্শন)',
    servingsPlaceholder: 'যেমন ৪ — খালি থাকলে ৪ ধরা হবে (সর্বোচ্চ ২০)',
    difficultySectionLabel: 'রান্নার কঠিনতা',
    difficultyEasy: 'সহজ',
    difficultyMedium: 'মাঝারি',
    difficultyHard: 'কঠিন',
    timeSectionLabel: 'সময়ের ফিল্টার',
    time15: '১৫ মিনিট',
    time30: '৩০ মিনিট',
    time45: '৪৫ মিনিট',
    time60: '৬০ মিনিট',
  },
  English: {
    dietSectionLabel: 'Diet',
    dietNone: 'Any',
    dietVegetarian: 'Vegetarian',
    dietVegan: 'Vegan',
    dietGlutenFree: 'Gluten-free',
    spiceSectionLabel: 'Spice level',
    spiceMild: 'Mild',
    spiceMedium: 'Medium',
    spiceHot: 'Hot',
    caloriesSectionLabel: 'Max kcal per meal (optional)',
    caloriesPlaceholder: 'e.g. 600 — empty = no limit',
    servingsSectionLabel: 'Servings (people)',
    servingsPlaceholder: 'e.g. 4 — empty defaults to 4 (max 20)',
    difficultySectionLabel: 'Recipe difficulty',
    difficultyEasy: 'Easy',
    difficultyMedium: 'Medium',
    difficultyHard: 'Hard',
    timeSectionLabel: 'Time filter',
    time15: '15 min',
    time30: '30 min',
    time45: '45 min',
    time60: '60 min',
  },
} as const;

const dietConflictUi = {
  বাংলা: {
    title: 'ডায়েট ও লেখার মিল নেই',
    msgVegetarian:
      'আপনি নিরামিষ বেছে নিয়েছেন, কিন্তু লেখায় মাছ বা মাংস জাতীয় উপাদানের ইঙ্গিত আছে। কী করতে চান?',
    msgVeganFlesh:
      'আপনি ভেগান বেছে নিয়েছেন, কিন্তু লেখায় মাছ বা মাংস জাতীয় উপাদানের ইঙ্গিত আছে। কী করতে চান?',
    msgVeganAnimal:
      'আপনি ভেগান বেছে নিয়েছেন, কিন্তু লেখায় দুধ, ডিম, মধু বা অন্য প্রাণিজ উপাদানের ইঙ্গিত আছে। কী করতে চান?',
    msgGluten:
      'আপনি গ্লুটেন-ফ্রি বেছে নিয়েছেন, কিন্তু লেখায় গম/ময়দা/গ্লুটেন জাতীয় উপাদানের ইঙ্গিত আছে। কী করতে চান?',
    btnCancel: 'বাতিল',
    btnResetDiet: 'ডায়েট সব করে চালান',
    btnContinue: 'তবু চালিয়ে যান',
  },
  English: {
    title: 'Diet vs input mismatch',
    msgVegetarian: 'You chose Vegetarian, but your text suggests meat or seafood. What would you like to do?',
    msgVeganFlesh: 'You chose Vegan, but your text suggests meat or seafood. What would you like to do?',
    msgVeganAnimal:
      'You chose Vegan, but your text suggests dairy, eggs, honey, or other animal products. What would you like to do?',
    msgGluten:
      'You chose Gluten-free, but your text suggests wheat flour or other gluten sources. What would you like to do?',
    btnCancel: 'Cancel',
    btnResetDiet: 'Set diet to Any & continue',
    btnContinue: 'Continue anyway',
  },
} as const;

function dietConflictMessage(
  reason: DietConflictReason,
  ui: (typeof dietConflictUi)[keyof typeof dietConflictUi]
): string {
  switch (reason) {
    case 'vegetarian_flesh':
      return ui.msgVegetarian;
    case 'vegan_flesh':
      return ui.msgVeganFlesh;
    case 'vegan_animal_product':
      return ui.msgVeganAnimal;
    case 'gluten_grain':
      return ui.msgGluten;
    default:
      return ui.msgVegetarian;
  }
}

export default function CraftScreen() {
  const params = useLocalSearchParams<{
    ingredient?: string;
    servings?: string | string[];
    difficultyLevel?: string | string[];
    cookTimeMinutes?: string | string[];
    selectedLang?: string | string[];
    selectedCuisine?: string | string[];
  }>();
  const router = useRouter();
  const [ingredient, setIngredient] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const [selectedLang, setSelectedLang] = useState(DEFAULT_UI_LANGUAGE);
  const [selectedCuisine, setSelectedCuisine] = useState(DEFAULT_CUISINE);
  const [generationMode, setGenerationMode] = useState<GenerationMode>('strict');
  const [dietPreference, setDietPreference] = useState<DietPreference>('none');
  const [spiceLevel, setSpiceLevel] = useState<SpiceLevel>('medium');
  const [difficultyLevel, setDifficultyLevel] = useState<DifficultyLevel>('medium');
  const [cookTimeMinutes, setCookTimeMinutes] = useState<number | null>(30);
  const [maxCaloriesInput, setMaxCaloriesInput] = useState('');
  const [servingsInput, setServingsInput] = useState('4');

  const [freeUsedToday, setFreeUsedToday] = useState(0);
  const [recognizingIngredients, setRecognizingIngredients] = useState(false);
  const [showVoiceFallbackHint, setShowVoiceFallbackHint] = useState(false);
  const ingredientInputRef = React.useRef<TextInput>(null);
  const fallbackHintTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const resolvedLanguage = languageAliasByCountry[selectedLang] ?? selectedLang;
  const uiText = uiTranslations[resolvedLanguage] ?? uiTranslations['English'];
  const dsUi = dietSpiceUi[resolvedLanguage as keyof typeof dietSpiceUi] ?? dietSpiceUi.English;

  const getTodayDateKey = () => new Date().toISOString().slice(0, 10);

  const loadDailyUsage = React.useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(DAILY_USAGE_STORAGE_KEY);
      if (!raw) {
        setFreeUsedToday(0);
        return;
      }
      const parsed = JSON.parse(raw) as { date?: string; used?: number };
      if (parsed?.date === getTodayDateKey()) {
        setFreeUsedToday(typeof parsed.used === 'number' ? parsed.used : 0);
      } else {
        setFreeUsedToday(0);
      }
    } catch {
      setFreeUsedToday(0);
    }
  }, []);

  const consumeFreeUsage = async () => {
    const nextUsed = freeUsedToday + 1;
    setFreeUsedToday(nextUsed);
    try {
      await AsyncStorage.setItem(
        DAILY_USAGE_STORAGE_KEY,
        JSON.stringify({
          date: getTodayDateKey(),
          used: nextUsed,
        })
      );
    } catch {
      // If persistence fails, in-memory count still protects the current session.
    }
  };

  const resetDailyUsageForDev = async () => {
    try {
      await AsyncStorage.setItem(
        DAILY_USAGE_STORAGE_KEY,
        JSON.stringify({
          date: getTodayDateKey(),
          used: 0,
        })
      );
      setFreeUsedToday(0);
      setErrorMessage('');
    } catch {
      // Ignore reset errors in dev helper.
    }
  };

  React.useEffect(() => {
    void loadDailyUsage();
  }, [loadDailyUsage]);

  React.useEffect(() => {
    if (typeof params.ingredient === 'string' && params.ingredient.trim()) {
      setIngredient(params.ingredient);
    }
  }, [params.ingredient]);

  React.useEffect(() => {
    return () => {
      if (fallbackHintTimerRef.current) {
        clearTimeout(fallbackHintTimerRef.current);
      }
    };
  }, []);

  React.useEffect(() => {
    const lang = paramString(params.selectedLang);
    const cuisine = paramString(params.selectedCuisine);
    const servingsParam = paramString(params.servings);
    const difficultyParam = paramString(params.difficultyLevel);
    const cookTimeParam = paramString(params.cookTimeMinutes);
    if (lang) setSelectedLang(lang);
    if (cuisine) setSelectedCuisine(cuisine);
    if (servingsParam) setServingsInput(String(parseServingsParam(servingsParam)));
    if (difficultyParam) setDifficultyLevel(normalizeDifficultyLevel(difficultyParam));
    if (cookTimeParam) setCookTimeMinutes(parseCookTimeMinutesParam(cookTimeParam));
  }, [params.selectedLang, params.selectedCuisine, params.servings, params.difficultyLevel, params.cookTimeMinutes]);

  const fetchWithTimeout = async (url: string, options: RequestInit, timeoutMs = 25000) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, { ...options, signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  };

  const isAbortError = (error: unknown) =>
    error instanceof Error && error.name === 'AbortError';

  const detectIngredientsFromBase64 = async (base64: string, mimeType: string) => {
    if (!API_BASE_URL) {
      setErrorMessage('EXPO_PUBLIC_API_BASE_URL সেট করা নেই। .env ফাইলে API URL দিন।');
      return;
    }

    setRecognizingIngredients(true);
    setErrorMessage('');
    try {
      const response = await fetchWithTimeout(
        `${API_BASE_URL}/api/v1/ai/ingredients/recognize`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageBase64: `data:${mimeType};base64,${base64}`,
            language: selectedLang,
          }),
        },
        45000
      );

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
      const ingredients = Array.isArray(data?.ingredients)
        ? data.ingredients.filter((x: unknown) => typeof x === 'string').map((x: string) => x.trim()).filter(Boolean)
        : [];
      if (!ingredients.length) {
        throw new Error('No ingredients recognized from image');
      }
      setIngredient(ingredients.slice(0, 12).join(', '));
    } catch (error: unknown) {
      if (isAbortError(error)) {
        setErrorMessage('Image recognition timed out. Please try again.');
      } else if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage('ছবি থেকে উপকরণ শনাক্ত করা যায়নি। আবার চেষ্টা করুন।');
      }
    } finally {
      setRecognizingIngredients(false);
    }
  };

  const recognizeIngredientsFromImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Please allow photo library access to scan ingredients.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.45,
      base64: true,
    });

    if (result.canceled || !result.assets[0]?.base64) return;
    const mimeType = result.assets[0].mimeType || 'image/jpeg';
    await detectIngredientsFromBase64(result.assets[0].base64, mimeType);
  };

  const recognizeIngredientsFromCamera = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Please allow camera access to scan ingredients.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 0.45,
      base64: true,
    });

    if (result.canceled || !result.assets[0]?.base64) return;
    const mimeType = result.assets[0].mimeType || 'image/jpeg';
    await detectIngredientsFromBase64(result.assets[0].base64, mimeType);
  };

  const startVoiceInput = async () => {
    setErrorMessage('');
    ingredientInputRef.current?.focus();
    setShowVoiceFallbackHint(true);
    if (fallbackHintTimerRef.current) {
      clearTimeout(fallbackHintTimerRef.current);
    }
    fallbackHintTimerRef.current = setTimeout(() => setShowVoiceFallbackHint(false), 5000);
  };

  const fetchRecipeNamesFromBackend = async (effectiveDiet: DietPreference) => {
    if (!API_BASE_URL) {
      throw new Error('EXPO_PUBLIC_API_BASE_URL সেট করা নেই। .env ফাইলে API URL দিন।');
    }

    const maxCaloriesPerMeal = parseMaxCaloriesParam(maxCaloriesInput.trim());
    const servings = parseServingsParam(servingsInput.trim());

    const response = await fetchWithTimeout(
      `${API_BASE_URL}/api/v1/ai/recipes/list`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: ingredient,
          ingredient,
          cuisine: selectedCuisine,
          language: selectedLang,
          generationMode,
          dietPreference: effectiveDiet,
          spiceLevel,
          servings,
          difficultyLevel,
          ...(cookTimeMinutes != null ? { cookTimeMinutes } : {}),
          ...(maxCaloriesPerMeal != null ? { maxCaloriesPerMeal } : {}),
        }),
      },
      RECIPE_LIST_FETCH_MS
    );

    if (!response.ok) {
      let message = `Backend request failed (${response.status})`;
      try {
        const errorJson = await response.json();
        if (typeof errorJson?.message === 'string') message = errorJson.message;
      } catch {
        // Ignore JSON parse errors for non-JSON responses.
      }
      throw new Error(message);
    }

    const data = await response.json();
    const recipes = Array.isArray(data?.recipes) ? data.recipes.filter((name: unknown) => typeof name === 'string') : [];
    if (recipes.length === 0) throw new Error('No recipes returned from backend');
    return recipes.slice(0, 10);
  };

  const saveRecentSearch = async (query: string, effectiveDiet: DietPreference) => {
    try {
      const raw = await AsyncStorage.getItem(RECENT_SEARCHES_STORAGE_KEY);
      const previous = raw
        ? (JSON.parse(raw) as {
            query: string;
            cuisine: string;
            language: string;
            generationMode?: GenerationMode;
            dietPreference?: DietPreference;
            spiceLevel?: SpiceLevel;
            maxCaloriesPerMeal?: string;
            servings?: string;
            difficultyLevel?: DifficultyLevel;
            cookTimeMinutes?: string;
            at: string;
          }[])
        : [];
      const maxCaloriesPerMeal = parseMaxCaloriesParam(maxCaloriesInput.trim());
      const servings = parseServingsParam(servingsInput.trim());
      const nextItem = {
        query,
        cuisine: selectedCuisine,
        language: selectedLang,
        generationMode,
        dietPreference: effectiveDiet,
        spiceLevel,
        maxCaloriesPerMeal: maxCaloriesPerMeal != null ? String(maxCaloriesPerMeal) : '',
        servings: String(servings),
        difficultyLevel,
        cookTimeMinutes: cookTimeMinutes != null ? String(cookTimeMinutes) : '',
        at: new Date().toISOString(),
      };
      const uniqueItems = [nextItem, ...previous.filter((item) => item.query !== query)];
      await AsyncStorage.setItem(RECENT_SEARCHES_STORAGE_KEY, JSON.stringify(uniqueItems.slice(0, 20)));
    } catch {
      // Keep flow uninterrupted when history storage fails.
    }
  };

  const executeCraftFlow = async (effectiveDiet: DietPreference) => {
    setLoading(true);
    setErrorMessage('');
    try {
      const recipeNames = await fetchRecipeNamesFromBackend(effectiveDiet);
      await saveRecentSearch(ingredient.trim(), effectiveDiet);
      const maxCaloriesPerMeal = parseMaxCaloriesParam(maxCaloriesInput.trim());
      const servings = parseServingsParam(servingsInput.trim());
      router.push({
        pathname: '/recipe-list',
        params: {
          recipes: JSON.stringify(recipeNames),
          ingredient,
          selectedCuisine,
          selectedLang,
          generationMode,
          dietPreference: effectiveDiet,
          spiceLevel,
          maxCaloriesPerMeal: maxCaloriesPerMeal != null ? String(maxCaloriesPerMeal) : '',
          servings: String(servings),
          difficultyLevel,
          cookTimeMinutes: cookTimeMinutes != null ? String(cookTimeMinutes) : '',
        },
      });
      await consumeFreeUsage();
    } catch (error: any) {
      if (!isAbortError(error)) {
        console.error(error);
      }
      if (isAbortError(error) || error?.message?.includes('408')) {
        setErrorMessage(
          resolvedLanguage === 'বাংলা'
            ? 'সার্ভার উত্তর দিতে সময় লাগছে বা সংযোগ টাইম আউট হয়েছে। নেটওয়ার্ক দেখে আবার চেষ্টা করুন।'
            : 'The server took too long or the connection timed out. Check your network and try again.'
        );
      } else if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage('রেসিপি লোড করা যায়নি। দয়া করে আবার চেষ্টা করুন।');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleStartCooking = async () => {
    const normalizedIngredient = cleanIngredientInput(ingredient);
    if (!normalizedIngredient) return;
    if (normalizedIngredient !== ingredient) {
      setIngredient(normalizedIngredient);
    }
    if (freeUsedToday >= DAILY_FREE_LIMIT) {
      setErrorMessage(uiText.freeLimitEnded);
      return;
    }

    const trimmed = normalizedIngredient;
    const conflict = analyzeDietInputConflict(dietPreference, trimmed);
    if (!conflict.ok) {
      const dcUi = dietConflictUi[resolvedLanguage as keyof typeof dietConflictUi] ?? dietConflictUi.English;
      Alert.alert(dcUi.title, dietConflictMessage(conflict.reason, dcUi), [
        { text: dcUi.btnCancel, style: 'cancel' },
        {
          text: dcUi.btnResetDiet,
          onPress: () => {
            setDietPreference('none');
            void executeCraftFlow('none');
          },
        },
        {
          text: dcUi.btnContinue,
          onPress: () => {
            void executeCraftFlow(dietPreference);
          },
        },
      ]);
      return;
    }

    await executeCraftFlow(dietPreference);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back">
          <MaterialIcons name="arrow-back" size={22} color="#d3b275" />
        </TouchableOpacity>
      </View>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent}>
        <View style={styles.modeCard}>
          <Text style={styles.modeSectionLabel}>{uiText.modeSectionLabel}</Text>
          <View style={styles.modeToggleRow}>
            <TouchableOpacity
              style={[styles.modeBtn, generationMode === 'strict' && styles.modeBtnActive]}
              onPress={() => setGenerationMode('strict')}
              accessibilityRole="button"
              accessibilityState={{ selected: generationMode === 'strict' }}>
              <Text style={[styles.modeBtnText, generationMode === 'strict' && styles.modeBtnTextActive]}>
                {uiText.strictModeLabel}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeBtn, generationMode === 'creative' && styles.modeBtnActive]}
              onPress={() => setGenerationMode('creative')}
              accessibilityRole="button"
              accessibilityState={{ selected: generationMode === 'creative' }}>
              <Text style={[styles.modeBtnText, generationMode === 'creative' && styles.modeBtnTextActive]}>
                {uiText.creativeModeLabel}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.prefCard}>
          <Text style={styles.prefSectionLabel}>{dsUi.dietSectionLabel}</Text>
          <View style={styles.dietGrid}>
            {(
              [
                ['none', dsUi.dietNone],
                ['vegetarian', dsUi.dietVegetarian],
                ['vegan', dsUi.dietVegan],
                ['gluten_free', dsUi.dietGlutenFree],
              ] as const
            ).map(([value, label]) => (
              <TouchableOpacity
                key={value}
                style={[styles.prefChip, dietPreference === value && styles.prefChipActive]}
                onPress={() => setDietPreference(value)}>
                <Text style={[styles.prefChipText, dietPreference === value && styles.prefChipTextActive]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={[styles.prefSectionLabel, styles.prefSectionSpaced]}>{dsUi.spiceSectionLabel}</Text>
          <View style={styles.modeToggleRow}>
            {(
              [
                ['mild', dsUi.spiceMild],
                ['medium', dsUi.spiceMedium],
                ['hot', dsUi.spiceHot],
              ] as const
            ).map(([value, label]) => (
              <TouchableOpacity
                key={value}
                style={[styles.modeBtn, spiceLevel === value && styles.modeBtnActive]}
                onPress={() => setSpiceLevel(value)}>
                <Text style={[styles.modeBtnText, spiceLevel === value && styles.modeBtnTextActive]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={[styles.prefSectionLabel, styles.prefSectionSpaced]}>{dsUi.difficultySectionLabel}</Text>
          <View style={styles.modeToggleRow}>
            {(
              [
                ['easy', dsUi.difficultyEasy],
                ['medium', dsUi.difficultyMedium],
                ['hard', dsUi.difficultyHard],
              ] as const
            ).map(([value, label]) => (
              <TouchableOpacity
                key={value}
                style={[styles.modeBtn, difficultyLevel === value && styles.modeBtnActive]}
                onPress={() => setDifficultyLevel(value)}>
                <Text style={[styles.modeBtnText, difficultyLevel === value && styles.modeBtnTextActive]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={[styles.prefSectionLabel, styles.prefSectionSpaced]}>{dsUi.timeSectionLabel}</Text>
          <View style={styles.timeGrid}>
            {(
              [
                [15, dsUi.time15],
                [30, dsUi.time30],
                [45, dsUi.time45],
                [60, dsUi.time60],
              ] as const
            ).map(([value, label]) => (
              <TouchableOpacity
                key={value}
                style={[styles.timeBtn, cookTimeMinutes === value && styles.modeBtnActive]}
                onPress={() => setCookTimeMinutes(value)}>
                <Text style={[styles.modeBtnText, cookTimeMinutes === value && styles.modeBtnTextActive]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={[styles.prefSectionLabel, styles.prefSectionSpaced]}>{dsUi.caloriesSectionLabel}</Text>
          <TextInput
            style={styles.caloriesInput}
            placeholder={dsUi.caloriesPlaceholder}
            placeholderTextColor="#555"
            value={maxCaloriesInput}
            onChangeText={setMaxCaloriesInput}
            keyboardType="number-pad"
          />
          <Text style={[styles.prefSectionLabel, styles.prefSectionSpaced]}>{dsUi.servingsSectionLabel}</Text>
          <TextInput
            style={styles.caloriesInput}
            placeholder={dsUi.servingsPlaceholder}
            placeholderTextColor="#555"
            value={servingsInput}
            onChangeText={setServingsInput}
            keyboardType="number-pad"
          />
        </View>

        <View style={styles.inputCard}>
          <Text style={styles.limitText}>
            {uiText.freeRemainingLabel}: {Math.max(DAILY_FREE_LIMIT - freeUsedToday, 0)} / {DAILY_FREE_LIMIT}
          </Text>
          <TextInput
            ref={ingredientInputRef}
            style={styles.input}
            placeholder={uiText.ingredientPlaceholder}
            placeholderTextColor="#555"
            value={ingredient}
            onChangeText={setIngredient}
            onEndEditing={(event) => setIngredient(cleanIngredientInput(event.nativeEvent.text))}
          />
          <TouchableOpacity
            style={styles.voiceButton}
            onPress={startVoiceInput}
            disabled={loading || recognizingIngredients}>
            <MaterialIcons name="mic" size={18} color="#d3b275" />
            <Text style={styles.voiceButtonText}>Use Voice Input (Keyboard Mic)</Text>
          </TouchableOpacity>
          {showVoiceFallbackHint ? (
            <Text style={styles.voiceHintText}>Keyboard খুলে mic আইকনে ট্যাপ করে কথা বলুন.</Text>
          ) : null}
          <View style={styles.scanRow}>
            <TouchableOpacity
              style={[styles.scanButton, recognizingIngredients && styles.scanButtonDisabled]}
              onPress={recognizeIngredientsFromCamera}
              disabled={recognizingIngredients || loading}>
              {recognizingIngredients ? (
                <ActivityIndicator color="#d3b275" />
              ) : (
                <Text style={styles.scanButtonText}>TAKE PHOTO</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.scanButton, recognizingIngredients && styles.scanButtonDisabled]}
              onPress={recognizeIngredientsFromImage}
              disabled={recognizingIngredients || loading}>
              {recognizingIngredients ? (
                <ActivityIndicator color="#d3b275" />
              ) : (
                <Text style={styles.scanButtonText}>PICK FROM GALLERY</Text>
              )}
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.button} onPress={handleStartCooking} disabled={loading || recognizingIngredients}>
            {loading ? <ActivityIndicator color="#000" /> : <Text style={styles.buttonText}>CRAFT RECIPE</Text>}
          </TouchableOpacity>
          {__DEV__ ? (
            <TouchableOpacity style={styles.devResetBtn} onPress={resetDailyUsageForDev}>
              <Text style={styles.devResetBtnText}>Reset Free Limit (Dev)</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
        <DesignerCreditLine />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  topBar: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  backBtn: {
    padding: 12,
    borderRadius: 12,
  },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40, alignItems: 'center' },
  modeCard: { width: '100%', marginBottom: 20 },
  modeSectionLabel: { color: '#666', fontSize: 10, textTransform: 'uppercase', marginBottom: 8, letterSpacing: 1.2 },
  modeToggleRow: { flexDirection: 'row', gap: 10 },
  modeBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#333',
    backgroundColor: '#111',
    alignItems: 'center',
  },
  modeBtnActive: { borderColor: '#d3b275', backgroundColor: '#1a1510' },
  modeBtnText: { color: '#888', fontSize: 15, fontWeight: '600' },
  modeBtnTextActive: { color: '#d3b275' },
  prefCard: { width: '100%', marginBottom: 20 },
  prefSectionLabel: { color: '#666', fontSize: 10, textTransform: 'uppercase', marginBottom: 8, letterSpacing: 1.2 },
  prefSectionSpaced: { marginTop: 14 },
  timeGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8 },
  timeBtn: { width: '48%' },
  dietGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  prefChip: {
    width: '48%',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#333',
    backgroundColor: '#111',
    alignItems: 'center',
    marginBottom: 8,
  },
  prefChipActive: { borderColor: '#d3b275', backgroundColor: '#1a1510' },
  prefChipText: { color: '#888', fontSize: 14, fontWeight: '600', textAlign: 'center' },
  prefChipTextActive: { color: '#d3b275' },
  caloriesInput: {
    color: '#fff',
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#0a0a0a',
  },
  inputCard: { width: '100%', backgroundColor: '#111', padding: 20, borderRadius: 15, borderWidth: 1, borderColor: '#222', marginBottom: 25 },
  limitText: { color: '#9f9f9f', fontSize: 12, marginBottom: 8 },
  input: { color: '#fff', fontSize: 16, borderBottomWidth: 1, borderBottomColor: '#333', paddingVertical: 12, marginBottom: 25 },
  voiceButton: {
    borderWidth: 1,
    borderColor: '#4a3f2a',
    backgroundColor: '#0f0f0f',
    borderRadius: 12,
    minHeight: 48,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  voiceButtonText: { color: '#d3b275', fontSize: 13, fontWeight: '700', letterSpacing: 0.5 },
  voiceHintText: { color: '#9f9f9f', fontSize: 12, marginBottom: 8 },
  button: { backgroundColor: '#d3b275', paddingVertical: 16, borderRadius: 12, alignItems: 'center' },
  buttonText: { color: '#000', fontSize: 18, fontWeight: 'bold', letterSpacing: 1.2 },
  scanRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  scanButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#444',
    backgroundColor: '#0f0f0f',
    minHeight: 56,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanButtonDisabled: { opacity: 0.65 },
  scanButtonText: { color: '#d3b275', fontSize: 13, fontWeight: '700', letterSpacing: 1, textAlign: 'center' },
  devResetBtn: {
    marginTop: 10,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#444',
    alignItems: 'center',
  },
  devResetBtnText: { color: '#bdbdbd', fontSize: 12, fontWeight: '600' },
  errorText: { color: '#ff7f7f', fontSize: 14, marginTop: 6, marginBottom: 8, textAlign: 'center' },
});
