import { DesignerCreditLine } from '@/components/designer-footer';
import { HomeExploreNav, HOME_EXPLORE_NAV_RESERVED_BOTTOM } from '@/components/home-explore-nav';
import {
  type BuiltinTimerSoundId,
  type TimerSoundPreference,
  getTimerSoundPreference,
  saveTimerSoundPreference,
} from '@/constants/timer-sound-preference';
import {
  DEFAULT_USER_PROFILE,
  loadUserProfile,
  saveUserProfile,
  type UserProfile,
} from '@/constants/user-profile';
import { previewTimerAlarm } from '@/lib/timer-alarm';
import * as DocumentPicker from 'expo-document-picker';
import { useRouter } from 'expo-router';
import React from 'react';
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function SettingsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [profile, setProfile] = React.useState<UserProfile>(DEFAULT_USER_PROFILE);
  const [loadingProfile, setLoadingProfile] = React.useState(true);
  const [saveNotice, setSaveNotice] = React.useState('');
  const [timerSound, setTimerSound] = React.useState<TimerSoundPreference>(() =>
    getTimerSoundPreference()
  );

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

  const persistTimerSound = async (next: TimerSoundPreference) => {
    setTimerSound(next);
    await saveTimerSoundPreference(next);
  };

  const selectBuiltinSound = async (builtin: BuiltinTimerSoundId) => {
    const next: TimerSoundPreference = {
      kind: 'builtin',
      builtin,
      customUri: null,
      customName: null,
    };
    await persistTimerSound(next);
  };

  const pickCustomAlarm = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['audio/*', 'audio/mpeg', 'audio/mp3', 'audio/x-wav', 'audio/wav', 'audio/x-m4a', 'audio/m4a'],
        copyToCacheDirectory: true,
        base64: false,
      });
      if (result.canceled || !result.assets?.length) return;
      const asset = result.assets[0];
      const uri = asset.uri?.trim();
      if (!uri) {
        Alert.alert('ফাইল খুলতে পারিনি', 'অন্য একটি অডিও ফাইল চেষ্টা করুন।');
        return;
      }
      const next: TimerSoundPreference = {
        kind: 'custom',
        builtin: 'classic',
        customUri: uri,
        customName: asset.name?.trim() || 'Custom audio',
      };
      await persistTimerSound(next);
    } catch {
      Alert.alert('ফাইল বাছাই ব্যর্থ', 'আবার চেষ্টা করুন অথবা বিল্ট-ইন শব্দ ব্যবহার করুন।');
    }
  };

  const clearCustomAlarm = async () => {
    await selectBuiltinSound('classic');
  };

  const onPreviewAlarm = () => {
    void previewTimerAlarm(timerSound);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.page}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <TouchableOpacity style={styles.back} onPress={() => router.back()} accessibilityRole="button">
          <Text style={styles.backText}>{t('common.back')}</Text>
        </TouchableOpacity>

        <Text style={styles.title}>{t('settings.title')}</Text>
        <Text style={styles.sub}>{t('settings.subtitle')}</Text>

        <View style={styles.profileCard}>
          <Text style={styles.profileTitle}>Profile</Text>
          <Text style={styles.profileSub}>These details help ChefAI personalize recipes for you.</Text>

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

        <View style={styles.timerCard}>
          <Text style={styles.timerCardTitle}>টাইমার অ্যালার্ম</Text>
          <Text style={styles.timerCardSub}>কুক মোডের টাইমার শেষ হলে যে শব্দ বাজবে—প্রিসেট বা নিজের অডিও।</Text>

          <Text style={styles.fieldLabel}>প্রিসেট</Text>
          <View style={styles.optionRow}>
            {(
              [
                ['classic', 'Classic'],
                ['soft', 'Soft'],
                ['bright', 'Bright'],
              ] as const
            ).map(([id, label]) => {
              const active = timerSound.kind === 'builtin' && timerSound.builtin === id;
              return (
                <TouchableOpacity
                  key={id}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => selectBuiltinSound(id)}
                  activeOpacity={0.85}>
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.fieldLabel}>নিজের ফাইল</Text>
          <TouchableOpacity
            style={[styles.pickFileBtn, Platform.OS === 'web' && styles.pickFileBtnDisabled]}
            onPress={pickCustomAlarm}
            disabled={Platform.OS === 'web'}
            activeOpacity={0.85}>
            <Text style={styles.pickFileBtnText}>
              {Platform.OS === 'web'
                ? 'কাস্টম ফাইল মোবাইল অ্যাপে উপলব্ধ'
                : 'অডিও ফাইল বেছে নিন (MP3 / WAV / M4A)'}
            </Text>
          </TouchableOpacity>
          {timerSound.kind === 'custom' && timerSound.customName ? (
            <View style={styles.customFileRow}>
              <Text style={styles.customFileName} numberOfLines={1}>
                নির্বাচিত: {timerSound.customName}
              </Text>
              <TouchableOpacity onPress={clearCustomAlarm} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={styles.clearCustomText}>সরান</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          <TouchableOpacity style={styles.previewBtn} onPress={onPreviewAlarm} activeOpacity={0.85}>
            <Text style={styles.previewBtnText}>শুনে দেখুন</Text>
          </TouchableOpacity>
        </View>

        <DesignerCreditLine />
      </ScrollView>
      <HomeExploreNav />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#000' },
  page: { flex: 1 },
  scroll: { padding: 20, paddingBottom: HOME_EXPLORE_NAV_RESERVED_BOTTOM },
  back: { alignSelf: 'flex-start', marginBottom: 16 },
  backText: { color: '#d3b275', fontSize: 15, fontWeight: '600' },
  title: { color: '#d3b275', fontSize: 28, fontWeight: 'bold' },
  sub: { color: '#ccc', fontSize: 14, lineHeight: 20, marginTop: 10, marginBottom: 8 },
  profileCard: {
    marginTop: 16,
    backgroundColor: '#101010',
    borderWidth: 1,
    borderColor: '#2b2b2b',
    borderRadius: 14,
    padding: 14,
  },
  profileTitle: { color: '#d3b275', fontSize: 20, fontWeight: '700' },
  profileSub: { color: '#9b9b9b', fontSize: 12, lineHeight: 18, marginTop: 6, marginBottom: 14 },
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
  timerCard: {
    marginTop: 18,
    backgroundColor: '#101010',
    borderWidth: 1,
    borderColor: '#2b2b2b',
    borderRadius: 14,
    padding: 14,
  },
  timerCardTitle: { color: '#d3b275', fontSize: 18, fontWeight: '700' },
  timerCardSub: { color: '#9b9b9b', fontSize: 12, lineHeight: 18, marginTop: 6, marginBottom: 8 },
  pickFileBtn: {
    marginTop: 4,
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#444',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  pickFileBtnDisabled: { opacity: 0.55 },
  pickFileBtnText: { color: '#e0e0e0', fontSize: 13, fontWeight: '600', textAlign: 'center' },
  customFileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 10,
  },
  customFileName: { flex: 1, color: '#bbb', fontSize: 12 },
  clearCustomText: { color: '#d3b275', fontSize: 13, fontWeight: '700' },
  previewBtn: {
    marginTop: 14,
    alignSelf: 'flex-start',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#d3b275',
    backgroundColor: '#1a1408',
  },
  previewBtnText: { color: '#d3b275', fontSize: 13, fontWeight: '700' },
});
