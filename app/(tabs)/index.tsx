import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  Dimensions,
  FlatList,
  Image,
  Modal,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DesignerCreditLine } from '@/components/designer-footer';
import { DEFAULT_CUISINE, DEFAULT_UI_LANGUAGE } from '@/constants/app-defaults';
import {
  formatCoreLanguagePickerLabel,
  RECIPE_CORE_LANGUAGES,
  RECIPE_COUNTRY_PICKER_OPTIONS,
  RECIPE_CUISINE_PICKER_OPTIONS,
} from '@/constants/recipe-language-options';

const { width } = Dimensions.get('window');

const countryPickerOptions = [...RECIPE_COUNTRY_PICKER_OPTIONS];
const coreLanguages = [...RECIPE_CORE_LANGUAGES];
const cuisines = [...RECIPE_CUISINE_PICKER_OPTIONS];

export default function HomeScreen() {
  const router = useRouter();
  const [selectedLang, setSelectedLang] = useState(DEFAULT_UI_LANGUAGE);
  const [selectedCuisine, setSelectedCuisine] = useState(DEFAULT_CUISINE);
  const [langCommitted, setLangCommitted] = useState(false);
  const [cuisineCommitted, setCuisineCommitted] = useState(false);
  const [langModal, setLangModal] = useState(false);
  const [cuisineModal, setCuisineModal] = useState(false);

  const nextVisualActive = langCommitted && cuisineCommitted;

  const goCraft = () => {
    router.push({
      pathname: '/craft',
      params: { selectedLang, selectedCuisine },
    });
  };

  const handleNextPress = () => {
    if (nextVisualActive) {
      goCraft();
      return;
    }
    setLangCommitted(true);
    setCuisineCommitted(true);
    requestAnimationFrame(() => {
      requestAnimationFrame(goCraft);
    });
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
                <Text style={styles.modalItemText}>{formatCoreLanguagePickerLabel(item)}</Text>
              </TouchableOpacity>
            ))}

            <Text style={styles.modalSectionTitle}>Countries</Text>
            {countryPickerOptions.map((item) => (
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
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="light-content" />
      <View style={styles.screenBody}>
        <View style={styles.topZone}>
          <View style={styles.header}>
            <Image source={require('@/assets/images/logo-main.png')} style={styles.logo} resizeMode="contain" />
            <Text style={styles.tagline}>YOUR AI-POWERED KITCHEN ASSISTANT</Text>
          </View>
        </View>

        <View style={styles.middleFill}>
          <View style={styles.centerZone}>
            <View style={styles.pickerRow}>
              <TouchableOpacity style={styles.pickerBtn} onPress={() => setLangModal(true)}>
                <Text style={styles.pickerLabel}>LANGUAGE</Text>
                <Text style={styles.pickerValue} numberOfLines={2}>
                  {formatCoreLanguagePickerLabel(selectedLang)}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.pickerBtn} onPress={() => setCuisineModal(true)}>
                <Text style={styles.pickerLabel}>CUISINE</Text>
                <Text style={styles.pickerValue} numberOfLines={2}>
                  {selectedCuisine}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.nextBlock}>
              <TouchableOpacity
                style={[styles.nextButton, !nextVisualActive && styles.nextButtonInactive]}
                onPress={handleNextPress}
                accessibilityRole="button"
                accessibilityLabel="Next">
                <Text style={[styles.nextButtonText, !nextVisualActive && styles.nextButtonTextInactive]}>NEXT</Text>
              </TouchableOpacity>
              <DesignerCreditLine style={styles.homeDesignerCredit} />
            </View>
          </View>
        </View>
      </View>

      <LanguageSelectionModal
        visible={langModal}
        onSelect={(value: string) => {
          setSelectedLang(value);
          setLangCommitted(true);
        }}
        onClose={() => setLangModal(false)}
      />
      <SelectionModal
        visible={cuisineModal}
        data={cuisines}
        onSelect={(value: string) => {
          setSelectedCuisine(value);
          setCuisineCommitted(true);
        }}
        onClose={() => setCuisineModal(false)}
        title="Select Cuisine"
      />
    </SafeAreaView>
  );
}

const GOLD = '#d3b275';
const NEXT_INACTIVE_BG = '#252525';
const NEXT_INACTIVE_TEXT = '#555555';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  screenBody: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 8,
  },
  topZone: { justifyContent: 'flex-start', alignItems: 'center', paddingTop: 28 },
  /** Fills space below header so pickers + NEXT + credit stay grouped; credit sits right under NEXT */
  middleFill: { flex: 1, width: '100%', justifyContent: 'center', alignItems: 'center' },
  centerZone: { width: '100%', alignItems: 'center', justifyContent: 'center', gap: 22 },
  nextBlock: { width: '100%', maxWidth: 420, alignItems: 'center', gap: 40 },
  /** Flush under NEXT (overrides default footer margins) */
  homeDesignerCredit: { marginTop: 0, marginBottom: 0 },
  header: { alignItems: 'center', justifyContent: 'center' },
  logo: { width: width * 0.88, height: 134, marginBottom: 2 },
  tagline: {
    color: GOLD,
    fontSize: 10,
    letterSpacing: 3,
    fontWeight: '500',
    opacity: 0.92,
    marginTop: -2,
    textAlign: 'center',
  },
  pickerRow: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', gap: 12 },
  pickerBtn: {
    flex: 1,
    backgroundColor: '#111',
    paddingVertical: 16,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    minHeight: 88,
    justifyContent: 'center',
  },
  pickerLabel: { color: '#888', fontSize: 10, letterSpacing: 1.2, marginBottom: 8 },
  pickerValue: { color: GOLD, fontSize: 17, fontWeight: 'bold' },
  nextButton: {
    backgroundColor: GOLD,
    paddingVertical: 15,
    paddingHorizontal: 28,
    borderRadius: 14,
    width: '100%',
    maxWidth: 420,
    alignItems: 'center',
  },
  nextButtonInactive: {
    backgroundColor: NEXT_INACTIVE_BG,
    borderWidth: 1,
    borderColor: '#333333',
  },
  nextButtonText: { color: '#000', fontSize: 16, fontWeight: 'bold', letterSpacing: 2 },
  nextButtonTextInactive: { color: NEXT_INACTIVE_TEXT },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: '#111', width: '85%', borderRadius: 25, padding: 20, borderWidth: 1, borderColor: '#d3b275', maxHeight: '75%' },
  modalTitle: { color: '#d3b275', fontSize: 22, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  modalSectionTitle: { color: '#8f8f8f', fontSize: 12, textTransform: 'uppercase', marginTop: 6, marginBottom: 4, letterSpacing: 1.2 },
  modalItem: { paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#222' },
  modalItemText: { color: '#fff', fontSize: 18, textAlign: 'center' },
  closeBtn: { marginTop: 20, padding: 10, backgroundColor: '#222', borderRadius: 10 },
  closeBtnText: { color: '#fff', textAlign: 'center', fontWeight: 'bold', letterSpacing: 2 },
});
