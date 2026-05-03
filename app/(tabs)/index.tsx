import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  Dimensions,
  FlatList,
  Image,
  Modal,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { DesignerCreditLine } from '@/components/designer-footer';
import { DEFAULT_CUISINE, DEFAULT_UI_LANGUAGE } from '@/constants/app-defaults';

const { width } = Dimensions.get('window');

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

export default function HomeScreen() {
  const router = useRouter();
  const [selectedLang, setSelectedLang] = useState(DEFAULT_UI_LANGUAGE);
  const [selectedCuisine, setSelectedCuisine] = useState(DEFAULT_CUISINE);
  const [langModal, setLangModal] = useState(false);
  const [cuisineModal, setCuisineModal] = useState(false);

  const goCraft = () => {
    router.push({
      pathname: '/craft',
      params: { selectedLang, selectedCuisine },
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
      <ScrollView contentContainerStyle={styles.scrollBody} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Image source={require('@/assets/images/logo-main.png')} style={styles.logo} resizeMode="contain" />
          <Text style={styles.tagline}>Your AI Powered Kitchen Assistant</Text>
        </View>

        <View style={styles.lowerBlock}>
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

        <TouchableOpacity
          style={styles.nextButton}
          onPress={goCraft}
          accessibilityRole="button"
          accessibilityLabel="Next">
          <Text style={styles.nextButtonText}>NEXT</Text>
        </TouchableOpacity>
        <DesignerCreditLine />
        </View>
      </ScrollView>

      <LanguageSelectionModal visible={langModal} onSelect={setSelectedLang} onClose={() => setLangModal(false)} />
      <SelectionModal visible={cuisineModal} data={cuisines} onSelect={setSelectedCuisine} onClose={() => setCuisineModal(false)} title="Select Cuisine" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  scrollBody: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingVertical: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: { alignItems: 'center', justifyContent: 'center', marginBottom: 0 },
  logo: { width: width * 0.85, height: 110, marginBottom: -5 },
  tagline: { color: '#d3b275', fontSize: 10, letterSpacing: 2, fontWeight: '500', opacity: 0.9 },
  lowerBlock: { width: '100%', marginTop: 44, alignItems: 'center' },
  pickerRow: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginBottom: 22 },
  pickerBtn: { backgroundColor: '#111', width: '48%', padding: 15, borderRadius: 12, borderWidth: 1, borderColor: '#222' },
  pickerLabel: { color: '#666', fontSize: 10, textTransform: 'uppercase', marginBottom: 5 },
  pickerValue: { color: '#d3b275', fontSize: 16, fontWeight: 'bold' },
  nextButton: {
    backgroundColor: '#d3b275',
    paddingVertical: 11,
    paddingHorizontal: 36,
    borderRadius: 10,
    minWidth: width * 0.42,
    alignItems: 'center',
  },
  nextButtonText: { color: '#000', fontSize: 15, fontWeight: 'bold', letterSpacing: 1.6 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: '#111', width: '85%', borderRadius: 25, padding: 20, borderWidth: 1, borderColor: '#d3b275', maxHeight: '75%' },
  modalTitle: { color: '#d3b275', fontSize: 22, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  modalSectionTitle: { color: '#8f8f8f', fontSize: 12, textTransform: 'uppercase', marginTop: 6, marginBottom: 4, letterSpacing: 1.2 },
  modalItem: { paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#222' },
  modalItemText: { color: '#fff', fontSize: 18, textAlign: 'center' },
  closeBtn: { marginTop: 20, padding: 10, backgroundColor: '#222', borderRadius: 10 },
  closeBtnText: { color: '#fff', textAlign: 'center', fontWeight: 'bold', letterSpacing: 2 },
});
