import { DesignerCreditLine } from '@/components/designer-footer';
import {
  HELP_BUNDLES,
  scoreHelpQuery,
  topicMatchesQuery,
} from '@/constants/help-bundles';
import { getSavedHelpPickerValue, setSavedHelpPickerValue } from '@/constants/help-storage';
import type { HelpBundle, HelpFaq, HelpTopic } from '@/constants/help-types';
import {
  RECIPE_CORE_LANGUAGES,
  RECIPE_COUNTRY_PICKER_OPTIONS,
  pickerValueToHelpLangId,
} from '@/constants/recipe-language-options';
import { tabScreenScrollPaddingBottom } from '@/constants/tab-screen-scroll-padding';
import { useRouter } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  LayoutAnimation,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  UIManager,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

const fabricRuntime =
  typeof global !== 'undefined' &&
  !!(global as { nativeFabricUIManager?: object }).nativeFabricUIManager;

if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental &&
  !fabricRuntime
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type Phase = 'loading' | 'pick' | 'main';

export default function SettingsHelpScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const scrollPad = tabScreenScrollPaddingBottom(insets.bottom);
  const [phase, setPhase] = React.useState<Phase>('loading');
  /** Exact home-style picker label (language or country). */
  const [pickerChoice, setPickerChoice] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState('');
  const [expandedTopicId, setExpandedTopicId] = React.useState<string | null>(null);
  const [expandedFaqId, setExpandedFaqId] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    getSavedHelpPickerValue().then((saved) => {
      if (cancelled) return;
      if (saved) {
        setPickerChoice(saved);
        setPhase('main');
      } else {
        setPhase('pick');
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const onPickHelpOption = async (value: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    await setSavedHelpPickerValue(value);
    setPickerChoice(value);
    setPhase('main');
    setQuery('');
    setExpandedTopicId(null);
    setExpandedFaqId(null);
  };

  const goPickLanguage = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setPhase('pick');
    setQuery('');
    setExpandedTopicId(null);
    setExpandedFaqId(null);
  };

  const toggleTopic = (id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedTopicId((prev) => (prev === id ? null : id));
    setExpandedFaqId(null);
  };

  const toggleFaq = (id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedFaqId((prev) => (prev === id ? null : id));
    setExpandedTopicId(null);
  };

  if (phase === 'loading') {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color="#d3b275" />
        </View>
      </SafeAreaView>
    );
  }

  if (phase === 'pick') {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.page}>
          <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: scrollPad }]}>
            <TouchableOpacity style={styles.back} onPress={() => router.back()} accessibilityRole="button">
              <Text style={styles.backText}>←</Text>
            </TouchableOpacity>
            <Text style={styles.title}>{t('help.pickTitle')}</Text>
            <Text style={styles.subPick}>{t('help.pickSub')}</Text>
            <Text style={styles.hintMuted}>{t('help.tapBelow')}</Text>
            <Text style={styles.modalSectionTitle}>{t('help.languagesHeading')}</Text>
            <View style={styles.langGrid}>
              {RECIPE_CORE_LANGUAGES.map((item) => (
                <TouchableOpacity
                  key={`lang-${item}`}
                  style={styles.langChip}
                  onPress={() => void onPickHelpOption(item)}
                  activeOpacity={0.85}>
                  <Text style={styles.langChipText}>{item}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={[styles.modalSectionTitle, styles.langSectionSpaced]}>{t('help.countriesHeading')}</Text>
            <View style={styles.langGrid}>
              {RECIPE_COUNTRY_PICKER_OPTIONS.map((item) => (
                <TouchableOpacity
                  key={`country-${item}`}
                  style={styles.langChip}
                  onPress={() => void onPickHelpOption(item)}
                  activeOpacity={0.85}>
                  <Text style={styles.langChipText}>{item}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.noticeSmall}>{t('help.pickFooter')}</Text>
            <DesignerCreditLine />
          </ScrollView>
        </View>
      </SafeAreaView>
    );
  }

  const effectiveChoice = pickerChoice?.trim() || 'English';
  const bundle: HelpBundle = HELP_BUNDLES[pickerValueToHelpLangId(effectiveChoice)];
  const q = query.trim();
  const filteredTopics: HelpTopic[] = q ? bundle.topics.filter((top) => topicMatchesQuery(q, top)) : bundle.topics;
  const rankedFaqs: { faq: HelpFaq; score: number }[] = q
    ? bundle.faqs
        .map((faq) => ({ faq, score: scoreHelpQuery(q, faq) }))
        .filter((x) => x.score > 0)
        .sort((a, b) => b.score - a.score)
    : bundle.faqs.map((faq) => ({ faq, score: 1 }));

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.page}>
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: scrollPad }]}
          keyboardShouldPersistTaps="handled">
          <TouchableOpacity style={styles.back} onPress={() => router.back()} accessibilityRole="button">
            <Text style={styles.backText}>←</Text>
          </TouchableOpacity>

          <Text style={styles.title}>{bundle.screenTitle}</Text>
          <Text style={styles.pickerChoiceMuted} numberOfLines={2}>
            {pickerChoice}
          </Text>
          <TouchableOpacity onPress={goPickLanguage} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.changeLangLink}>{bundle.changeLanguage}</Text>
          </TouchableOpacity>

          <View style={styles.noticeBox}>
            <Text style={styles.noticeText}>{bundle.onlyChefAiNotice}</Text>
            <Text style={styles.noticeTextMuted}>{bundle.noNetworkLegal}</Text>
          </View>

          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={bundle.searchPlaceholder}
            placeholderTextColor="#686868"
            style={styles.search}
          />

          <Text style={styles.sectionTitle}>{bundle.topicsHeading}</Text>
          {filteredTopics.length === 0 ? (
            <Text style={styles.empty}>{bundle.noSearchResults}</Text>
          ) : (
            filteredTopics.map((topic) => (
              <View key={topic.id} style={styles.card}>
                <TouchableOpacity onPress={() => toggleTopic(topic.id)} activeOpacity={0.85}>
                  <Text style={styles.cardTitle}>{topic.title}</Text>
                </TouchableOpacity>
                {expandedTopicId === topic.id ? <Text style={styles.cardBody}>{topic.body}</Text> : null}
              </View>
            ))
          )}

          <Text style={[styles.sectionTitle, styles.sectionSpaced]}>{bundle.faqHeading}</Text>
          {q && rankedFaqs.length === 0 ? (
            <Text style={styles.empty}>{bundle.noSearchResults}</Text>
          ) : (
            rankedFaqs.map(({ faq }) => (
              <View key={faq.id} style={styles.card}>
                <TouchableOpacity onPress={() => toggleFaq(faq.id)} activeOpacity={0.85}>
                  <Text style={styles.cardTitle}>{faq.q}</Text>
                </TouchableOpacity>
                {expandedFaqId === faq.id ? <Text style={styles.cardBody}>{faq.a}</Text> : null}
              </View>
            ))
          )}

          <DesignerCreditLine />
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#000' },
  page: { flex: 1 },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { padding: 20 },
  back: { alignSelf: 'flex-start', marginBottom: 12 },
  backText: { color: '#d3b275', fontSize: 22, fontWeight: '600' },
  title: { color: '#d3b275', fontSize: 26, fontWeight: 'bold' },
  subPick: { color: '#ccc', fontSize: 14, lineHeight: 21, marginTop: 12 },
  hintMuted: { color: '#777', fontSize: 12, marginTop: 8, marginBottom: 16 },
  modalSectionTitle: { color: '#aaa', fontSize: 13, fontWeight: '700', marginTop: 14, marginBottom: 8 },
  langSectionSpaced: { marginTop: 22 },
  langGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 4 },
  langChip: {
    borderWidth: 1,
    borderColor: '#d3b275',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 18,
    backgroundColor: '#141208',
  },
  langChipText: { color: '#d3b275', fontSize: 14, fontWeight: '700' },
  pickerChoiceMuted: { color: '#888', fontSize: 12, marginTop: 6, lineHeight: 17 },
  noticeSmall: { color: '#888', fontSize: 11, lineHeight: 16, marginTop: 24 },
  changeLangLink: { color: '#9fd4ff', fontSize: 14, marginTop: 8, fontWeight: '600' },
  noticeBox: {
    marginTop: 14,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#333',
    backgroundColor: '#101010',
  },
  noticeText: { color: '#c8c8c8', fontSize: 12, lineHeight: 18 },
  noticeTextMuted: { color: '#777', fontSize: 11, lineHeight: 16, marginTop: 8 },
  search: {
    marginTop: 16,
    backgroundColor: '#161616',
    borderWidth: 1,
    borderColor: '#343434',
    borderRadius: 10,
    color: '#f1f1f1',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  sectionTitle: { color: '#d3b275', fontSize: 17, fontWeight: '700', marginTop: 20 },
  sectionSpaced: { marginTop: 28 },
  card: {
    marginTop: 10,
    backgroundColor: '#101010',
    borderWidth: 1,
    borderColor: '#2b2b2b',
    borderRadius: 12,
    padding: 12,
  },
  cardTitle: { color: '#eee', fontSize: 15, fontWeight: '700' },
  cardBody: { color: '#bbb', fontSize: 13, lineHeight: 20, marginTop: 10 },
  empty: { color: '#888', fontSize: 13, marginTop: 8 },
});
