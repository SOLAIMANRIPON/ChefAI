import { DesignerCreditLine } from '@/components/designer-footer';
import {
  type BuiltinTimerSoundId,
  type TimerSoundPreference,
  getTimerSoundPreference,
  saveTimerSoundPreference,
} from '@/constants/timer-sound-preference';
import { tabScreenScrollPaddingBottom } from '@/constants/tab-screen-scroll-padding';
import { previewTimerAlarm } from '@/lib/timer-alarm';
import * as DocumentPicker from 'expo-document-picker';
import { useRouter } from 'expo-router';
import React from 'react';
import { Alert, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

export default function SettingsTimerScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [timerSound, setTimerSound] = React.useState<TimerSoundPreference>(() => getTimerSoundPreference());

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
        Alert.alert('Could not open file', 'Try a different audio file.');
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
      Alert.alert('Pick failed', 'Try again or use a built-in sound.');
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
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: tabScreenScrollPaddingBottom(insets.bottom) }]}>
          <TouchableOpacity style={styles.back} onPress={() => router.back()} accessibilityRole="button">
            <Text style={styles.backText}>{t('common.back')}</Text>
          </TouchableOpacity>

          <Text style={styles.title}>Timer alarm</Text>
          <Text style={styles.sub}>
            Sound that plays when a cook-mode timer ends — choose a preset or your own audio file (mobile).
          </Text>

          <View style={styles.card}>
            <Text style={styles.fieldLabel}>Presets</Text>
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

            <Text style={styles.fieldLabel}>Custom file</Text>
            <TouchableOpacity
              style={[styles.pickFileBtn, Platform.OS === 'web' && styles.pickFileBtnDisabled]}
              onPress={pickCustomAlarm}
              disabled={Platform.OS === 'web'}
              activeOpacity={0.85}>
              <Text style={styles.pickFileBtnText}>
                {Platform.OS === 'web' ? 'Custom files are available in the mobile app.' : 'Pick audio file (MP3 / WAV / M4A)'}
              </Text>
            </TouchableOpacity>
            {timerSound.kind === 'custom' && timerSound.customName ? (
              <View style={styles.customFileRow}>
                <Text style={styles.customFileName} numberOfLines={1}>
                  Selected: {timerSound.customName}
                </Text>
                <TouchableOpacity onPress={clearCustomAlarm} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Text style={styles.clearCustomText}>Clear</Text>
                </TouchableOpacity>
              </View>
            ) : null}

            <TouchableOpacity style={styles.previewBtn} onPress={onPreviewAlarm} activeOpacity={0.85}>
              <Text style={styles.previewBtnText}>Preview</Text>
            </TouchableOpacity>
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
