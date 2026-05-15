import { DesignerCreditLine } from '@/components/designer-footer';
import {
  DEFAULT_USER_PROFILE,
  loadUserProfile,
  saveUserProfile,
  type UserProfile,
} from '@/constants/user-profile';
import { tabScreenScrollPaddingBottom } from '@/constants/tab-screen-scroll-padding';
import { useRouter } from 'expo-router';
import React from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

export default function SettingsProfileScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [profile, setProfile] = React.useState<UserProfile>(DEFAULT_USER_PROFILE);
  const [loadingProfile, setLoadingProfile] = React.useState(true);
  const [saveNotice, setSaveNotice] = React.useState('');

  React.useEffect(() => {
    let cancelled = false;
    loadUserProfile().then((p) => {
      if (!cancelled) {
        setProfile(p);
        setLoadingProfile(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const saveProfileSection = async () => {
    await saveUserProfile(profile);
    setSaveNotice('Profile saved');
    setTimeout(() => setSaveNotice(''), 1500);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.page}>
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: tabScreenScrollPaddingBottom(insets.bottom) }]}>
          <TouchableOpacity style={styles.back} onPress={() => router.back()} accessibilityRole="button">
            <Text style={styles.backText}>{t('common.back')}</Text>
          </TouchableOpacity>

          <Text style={styles.title}>Profile</Text>
          <Text style={styles.sub}>These details help ChefAI personalize recipes for you.</Text>

          <View style={styles.card}>
            <Text style={styles.fieldLabel}>Name</Text>
            <TextInput
              value={profile.name}
              onChangeText={(name) => setProfile((prev) => ({ ...prev, name }))}
              placeholder="Your name"
              placeholderTextColor="#686868"
              style={styles.input}
            />

            <Text style={styles.fieldLabel}>Diet</Text>
            <View style={styles.optionRow}>
              {(['None', 'Vegetarian', 'Vegan', 'Halal'] as const).map((item) => {
                const active = profile.dietPreference === item;
                return (
                  <TouchableOpacity
                    key={item}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => setProfile((prev) => ({ ...prev, dietPreference: item }))}
                    activeOpacity={0.85}>
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{item}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.fieldLabel}>Cooking Level</Text>
            <View style={styles.optionRow}>
              {(['Beginner', 'Intermediate', 'Advanced'] as const).map((item) => {
                const active = profile.cookingLevel === item;
                return (
                  <TouchableOpacity
                    key={item}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => setProfile((prev) => ({ ...prev, cookingLevel: item }))}
                    activeOpacity={0.85}>
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{item}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.fieldLabel}>Allergies</Text>
            <TextInput
              value={profile.allergies}
              onChangeText={(allergies) => setProfile((prev) => ({ ...prev, allergies }))}
              placeholder="e.g. Peanut, Dairy"
              placeholderTextColor="#686868"
              style={[styles.input, styles.inputTall]}
              multiline
            />

            <TouchableOpacity
              style={[styles.saveBtn, loadingProfile && styles.saveBtnDisabled]}
              onPress={saveProfileSection}
              disabled={loadingProfile}
              activeOpacity={0.85}>
              <Text style={styles.saveBtnText}>{loadingProfile ? 'Loading...' : 'Save Profile'}</Text>
            </TouchableOpacity>
            {saveNotice ? <Text style={styles.saveNotice}>{saveNotice}</Text> : null}
          </View>

          <DesignerCreditLine />
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#000' },
  page: { flex: 1 },
  scroll: { padding: 20 },
  back: { alignSelf: 'flex-start', marginBottom: 16 },
  backText: { color: '#d3b275', fontSize: 15, fontWeight: '600' },
  title: { color: '#d3b275', fontSize: 28, fontWeight: 'bold' },
  sub: { color: '#ccc', fontSize: 14, lineHeight: 20, marginTop: 10, marginBottom: 8 },
  card: {
    marginTop: 16,
    backgroundColor: '#101010',
    borderWidth: 1,
    borderColor: '#2b2b2b',
    borderRadius: 14,
    padding: 14,
  },
  fieldLabel: { color: '#cfcfcf', fontSize: 13, marginTop: 8, marginBottom: 7 },
  input: {
    backgroundColor: '#161616',
    borderWidth: 1,
    borderColor: '#343434',
    borderRadius: 10,
    color: '#f1f1f1',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  inputTall: { minHeight: 74, textAlignVertical: 'top' },
  optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: '#3a3a3a',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: '#161616',
  },
  chipActive: { borderColor: '#d3b275', backgroundColor: '#1f1a10' },
  chipText: { color: '#cfcfcf', fontSize: 12, fontWeight: '600' },
  chipTextActive: { color: '#d3b275' },
  saveBtn: {
    marginTop: 14,
    backgroundColor: '#d3b275',
    borderRadius: 10,
    alignItems: 'center',
    paddingVertical: 12,
  },
  saveBtnDisabled: { opacity: 0.65 },
  saveBtnText: { color: '#000', fontSize: 14, fontWeight: '700' },
  saveNotice: { color: '#d3b275', fontSize: 12, marginTop: 8, textAlign: 'center' },
});
