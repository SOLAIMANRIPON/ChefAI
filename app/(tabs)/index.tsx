import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  Modal,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

const { width } = Dimensions.get('window');
const DAILY_FREE_LIMIT = 5;
const DAILY_USAGE_STORAGE_KEY = 'chefai_daily_usage_v1';
const RECENT_SEARCHES_STORAGE_KEY = 'chefai_recent_searches_v1';
const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;

const popularFoodCountries = [
  'Bangladesh',
  'India',
  'Pakistan',
  'China',
  'Japan',
  'Thailand',
  'Korea',
  'Turkey',
  'Iran',
  'Saudi Arabia',
  'United Arab Emirates',
  'Italy',
  'France',
  'Spain',
  'Greece',
  'Mexico',
  'United States',
  'Brazil',
  'Argentina',
  'United Kingdom',
];

const coreLanguages = ['বাংলা', 'English', 'Hindi', 'Arabic', 'French', 'Spanish', 'Urdu'];
const cuisines = ['Bangladeshi', 'Indian', 'Italian', 'Chinese', 'Mexican', 'Thai', 'Turkish', 'Japanese', ...popularFoodCountries];
const uiTranslations: Record<
  string,
  {
    freeRemainingLabel: string;
    ingredientPlaceholder: string;
    freeLimitEnded: string;
  }
> = {
  বাংলা: {
    freeRemainingLabel: 'আজ ফ্রি বাকি',
    ingredientPlaceholder: 'উপকরণের নাম অথবা খাবারের নাম লিখুন...',
    freeLimitEnded: 'আজকের ৫টি ফ্রি রিকোয়েস্ট শেষ। আরও ব্যবহার করতে ক্রেডিট/সাবস্ক্রিপশন নিন।',
  },
  English: {
    freeRemainingLabel: 'Free left today',
    ingredientPlaceholder: 'Enter ingredient or dish name...',
    freeLimitEnded: 'Today\'s 5 free requests are used up. Buy credits or subscribe to continue.',
  },
  Hindi: {
    freeRemainingLabel: 'आज फ्री बाकी',
    ingredientPlaceholder: 'सामग्री या डिश का नाम लिखें...',
    freeLimitEnded: 'आज की 5 फ्री रिक्वेस्ट खत्म हो गई हैं। आगे बढ़ने के लिए क्रेडिट या सब्सक्रिप्शन लें।',
  },
  Arabic: {
    freeRemainingLabel: 'المتبقي المجاني اليوم',
    ingredientPlaceholder: 'اكتب اسم المكون او اسم الطبق...',
    freeLimitEnded: 'انتهت 5 طلباتك المجانية لليوم. اشترِ رصيدًا أو اشترك للمتابعة.',
  },
  French: {
    freeRemainingLabel: 'Gratuit restant aujourd\'hui',
    ingredientPlaceholder: 'Entrez le nom d\'un ingredient ou d\'un plat...',
    freeLimitEnded: 'Vos 5 requetes gratuites du jour sont terminees. Achetez des credits ou abonnez-vous.',
  },
  Spanish: {
    freeRemainingLabel: 'Gratis restante hoy',
    ingredientPlaceholder: 'Escribe el nombre del ingrediente o del plato...',
    freeLimitEnded: 'Tus 5 solicitudes gratis de hoy se han agotado. Compra creditos o suscribete para continuar.',
  },
  Urdu: {
    freeRemainingLabel: 'آج فری باقی',
    ingredientPlaceholder: 'اجزاء کا نام یا کھانے کا نام لکھیں...',
    freeLimitEnded: 'آج کی 5 فری درخواستیں ختم ہو چکی ہیں۔ مزید کے لیے کریڈٹ خریدیں یا سبسکرائب کریں۔',
  },
  Japanese: {
    freeRemainingLabel: '本日の無料残り',
    ingredientPlaceholder: '材料名または料理名を入力してください...',
    freeLimitEnded: '本日の無料5回分は終了しました。続行するにはクレジット購入または登録してください。',
  },
  Chinese: {
    freeRemainingLabel: '今日剩余免费次数',
    ingredientPlaceholder: '请输入食材名称或菜名...',
    freeLimitEnded: '今天的5次免费请求已用完。请购买额度或订阅继续使用。',
  },
  Korean: {
    freeRemainingLabel: '오늘 남은 무료 횟수',
    ingredientPlaceholder: '재료 이름 또는 음식 이름을 입력하세요...',
    freeLimitEnded: '오늘의 무료 5회 요청을 모두 사용했습니다. 계속하려면 크레딧 구매 또는 구독이 필요합니다.',
  },
  Turkish: {
    freeRemainingLabel: 'Bugun kalan ucretsiz hak',
    ingredientPlaceholder: 'Malzeme veya yemek adini yazin...',
    freeLimitEnded: 'Bugunku 5 ucretsiz istek doldu. Devam etmek icin kredi satin alin veya abone olun.',
  },
  Persian: {
    freeRemainingLabel: 'باقی مانده رایگان امروز',
    ingredientPlaceholder: 'نام ماده يا نام غذا را وارد کنيد...',
    freeLimitEnded: '۵ درخواست رايگان امروز تمام شده است. براي ادامه اعتبار خريداري کنيد يا اشتراک بگيريد.',
  },
  Portuguese: {
    freeRemainingLabel: 'Gratis restante hoje',
    ingredientPlaceholder: 'Digite o nome do ingrediente ou do prato...',
    freeLimitEnded: 'As 5 solicitacoes gratis de hoje acabaram. Compre creditos ou assine para continuar.',
  },
  Greek: {
    freeRemainingLabel: 'Δωρεαν υπολοιπο σημερα',
    ingredientPlaceholder: 'Γραψτε ονομα υλικου ή φαγητου...',
    freeLimitEnded: 'Οι 5 δωρεαν αιτησεις της ημερας τελειωσαν. Αγοραστε πιστωσεις ή κανετε συνδρομη.',
  },
};

const languageAliasByCountry: Record<string, keyof typeof uiTranslations> = {
  Bangladesh: 'বাংলা',
  India: 'Hindi',
  Pakistan: 'Urdu',
  China: 'Chinese',
  Japan: 'Japanese',
  Thailand: 'English',
  Korea: 'Korean',
  Turkey: 'Turkish',
  Iran: 'Persian',
  'Saudi Arabia': 'Arabic',
  'United Arab Emirates': 'Arabic',
  Italy: 'English',
  France: 'French',
  Spain: 'Spanish',
  Greece: 'Greek',
  Mexico: 'Spanish',
  'United States': 'English',
  Brazil: 'Portuguese',
  Argentina: 'Spanish',
  'United Kingdom': 'English',
};

export default function ChefAI() {
  const params = useLocalSearchParams<{ ingredient?: string }>();
  const router = useRouter();
  const [ingredient, setIngredient] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  
  const [selectedLang, setSelectedLang] = useState('বাংলা');
  const [selectedCuisine, setSelectedCuisine] = useState('Bangladeshi');
  
  const [langModal, setLangModal] = useState(false);
  const [cuisineModal, setCuisineModal] = useState(false);
  const [freeUsedToday, setFreeUsedToday] = useState(0);
  const resolvedLanguage = languageAliasByCountry[selectedLang] ?? selectedLang;
  const uiText = uiTranslations[resolvedLanguage] ?? uiTranslations['English'];

  const getTodayDateKey = () => new Date().toISOString().slice(0, 10);

  const loadDailyUsage = async () => {
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
  };

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
    loadDailyUsage();
  }, []);

  React.useEffect(() => {
    if (typeof params.ingredient === 'string' && params.ingredient.trim()) {
      setIngredient(params.ingredient);
    }
  }, [params.ingredient]);

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

  const fetchRecipeNamesFromBackend = async () => {
    if (!API_BASE_URL) {
      throw new Error('EXPO_PUBLIC_API_BASE_URL সেট করা নেই। .env ফাইলে API URL দিন।');
    }

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
        }),
      },
      25000
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

  const saveRecentSearch = async (query: string) => {
    try {
      const raw = await AsyncStorage.getItem(RECENT_SEARCHES_STORAGE_KEY);
      const previous = raw ? (JSON.parse(raw) as Array<{ query: string; cuisine: string; language: string; at: string }>) : [];
      const nextItem = {
        query,
        cuisine: selectedCuisine,
        language: selectedLang,
        at: new Date().toISOString(),
      };
      const uniqueItems = [nextItem, ...previous.filter((item) => item.query !== query)];
      await AsyncStorage.setItem(RECENT_SEARCHES_STORAGE_KEY, JSON.stringify(uniqueItems.slice(0, 20)));
    } catch {
      // Keep flow uninterrupted when history storage fails.
    }
  };

  const handleStartCooking = async () => {
    if (!ingredient.trim()) return;
    if (freeUsedToday >= DAILY_FREE_LIMIT) {
      setErrorMessage(uiText.freeLimitEnded);
      return;
    }
    setLoading(true);
    setErrorMessage('');
    try {
      const recipeNames = await fetchRecipeNamesFromBackend();
      await saveRecentSearch(ingredient.trim());
      router.push({
        pathname: '/recipe-list',
        params: {
          recipes: JSON.stringify(recipeNames),
          ingredient,
          selectedCuisine,
          selectedLang,
        },
      });
      await consumeFreeUsage();
    } catch (error: any) {
      console.error(error);
      if (isAbortError(error) || error?.message?.includes('408')) {
        setErrorMessage('Request timed out. Please try again.');
      } else if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage('রেসিপি লোড করা যায়নি। দয়া করে আবার চেষ্টা করুন।');
      }
    } finally {
      setLoading(false);
    }
  };

  const SelectionModal = ({ visible, data, onSelect, onClose, title }: any) => (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>{title}</Text>
          <FlatList<string>
            data={data}
            keyExtractor={(item) => item}
            renderItem={({ item }: { item: string }) => (
              <TouchableOpacity style={styles.modalItem} onPress={() => { onSelect(item); onClose(); }}>
                <Text style={styles.modalItemText}>{item}</Text>
              </TouchableOpacity>
            )}
          />
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeBtnText}>CLOSE</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  const LanguageSelectionModal = ({ visible, onSelect, onClose }: any) => (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Select Language</Text>
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={styles.modalSectionTitle}>Languages</Text>
            {coreLanguages.map((item) => (
              <TouchableOpacity key={`lang-${item}`} style={styles.modalItem} onPress={() => { onSelect(item); onClose(); }}>
                <Text style={styles.modalItemText}>{item}</Text>
              </TouchableOpacity>
            ))}

            <Text style={styles.modalSectionTitle}>Countries</Text>
            {popularFoodCountries.map((item) => (
              <TouchableOpacity key={`country-${item}`} style={styles.modalItem} onPress={() => { onSelect(item); onClose(); }}>
                <Text style={styles.modalItemText}>{item}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeBtnText}>CLOSE</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        <View style={styles.header}>
          <Image source={require('@/assets/images/logo-main.png')} style={styles.logo} resizeMode="contain" />
          <Text style={styles.tagline}>Your AI Powered Kitchen Assistant</Text>
        </View>

        <View style={styles.pickerRow}>
          <TouchableOpacity style={styles.pickerBtn} onPress={() => setLangModal(true)}>
            <Text style={styles.pickerLabel}>LANGUAGE</Text>
            <Text style={styles.pickerValue}>{selectedLang}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.pickerBtn} onPress={() => setCuisineModal(true)}>
            <Text style={styles.pickerLabel}>CUISINE</Text>
            <Text style={styles.pickerValue}>{selectedCuisine}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.inputCard}>
          <Text style={styles.limitText}>
            {uiText.freeRemainingLabel}: {Math.max(DAILY_FREE_LIMIT - freeUsedToday, 0)} / {DAILY_FREE_LIMIT}
          </Text>
          <TextInput
            style={styles.input}
            placeholder={uiText.ingredientPlaceholder}
            placeholderTextColor="#555"
            value={ingredient}
            onChangeText={setIngredient}
          />
          <TouchableOpacity style={styles.button} onPress={handleStartCooking} disabled={loading}>
            {loading ? <ActivityIndicator color="#000" /> : <Text style={styles.buttonText}>CRAFT RECIPE</Text>}
          </TouchableOpacity>
          {__DEV__ ? (
            <TouchableOpacity style={styles.devResetBtn} onPress={resetDailyUsageForDev}>
              <Text style={styles.devResetBtnText}>Reset Free Limit (Dev)</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

        <Text style={styles.footerText}>DESIGNED BY SOLAIMAN • 2026</Text>
      </ScrollView>

      <LanguageSelectionModal visible={langModal} onSelect={setSelectedLang} onClose={() => setLangModal(false)} />
      <SelectionModal visible={cuisineModal} data={cuisines} onSelect={setSelectedCuisine} onClose={() => setCuisineModal(false)} title="Select Cuisine" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  scrollContent: { padding: 20, alignItems: 'center' },
  header: { marginTop: 80, marginBottom: 45, alignItems: 'center', justifyContent: 'center' },
  logo: { width: width * 0.85, height: 110, marginBottom: -5 },
  tagline: { color: '#d3b275', fontSize: 10, letterSpacing: 2, fontWeight: '500', opacity: 0.9 },
  pickerRow: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginBottom: 25 },
  pickerBtn: { backgroundColor: '#111', width: '48%', padding: 15, borderRadius: 12, borderWidth: 1, borderColor: '#222' },
  pickerLabel: { color: '#666', fontSize: 10, textTransform: 'uppercase', marginBottom: 5 },
  pickerValue: { color: '#d3b275', fontSize: 16, fontWeight: 'bold' },
  inputCard: { width: '100%', backgroundColor: '#111', padding: 20, borderRadius: 15, borderWidth: 1, borderColor: '#222', marginBottom: 25 },
  limitText: { color: '#9f9f9f', fontSize: 12, marginBottom: 8 },
  input: { color: '#fff', fontSize: 16, borderBottomWidth: 1, borderBottomColor: '#333', paddingVertical: 12, marginBottom: 25 },
  button: { backgroundColor: '#d3b275', paddingVertical: 16, borderRadius: 12, alignItems: 'center' },
  buttonText: { color: '#000', fontSize: 18, fontWeight: 'bold', letterSpacing: 1.2 },
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
  footerText: { color: '#444', fontSize: 10, letterSpacing: 4, marginTop: 20, marginBottom: 40 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: '#111', width: '85%', borderRadius: 25, padding: 20, borderWidth: 1, borderColor: '#d3b275', maxHeight: '75%' },
  modalTitle: { color: '#d3b275', fontSize: 22, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  modalSectionTitle: { color: '#8f8f8f', fontSize: 12, textTransform: 'uppercase', marginTop: 6, marginBottom: 4, letterSpacing: 1.2 },
  modalItem: { paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#222' },
  modalItemText: { color: '#fff', fontSize: 18, textAlign: 'center' },
  closeBtn: { marginTop: 20, padding: 10, backgroundColor: '#222', borderRadius: 10 },
  closeBtnText: { color: '#fff', textAlign: 'center', fontWeight: 'bold', letterSpacing: 2 },
});