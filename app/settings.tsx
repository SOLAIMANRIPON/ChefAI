import {
  setFollowDeviceLanguage,
  setStoredAppLanguage,
  systemAppLanguage,
} from '@/constants/app-language';
import i18n, { SUPPORTED_APP_LANGUAGES, type AppLanguage } from '@/lib/i18n';
import { useRouter } from 'expo-router';
import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function SettingsScreen() {
  const { t, i18n: i18next } = useTranslation();
  const router = useRouter();
  const current = i18next.language.slice(0, 2) as AppLanguage;

  const select = async (lng: AppLanguage) => {
    await setStoredAppLanguage(lng);
    await i18n.changeLanguage(lng);
    router.back();
  };

  const useDevice = async () => {
    await setFollowDeviceLanguage();
    await i18n.changeLanguage(systemAppLanguage());
    router.back();
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <TouchableOpacity style={styles.back} onPress={() => router.back()} accessibilityRole="button">
          <Text style={styles.backText}>{t('common.back')}</Text>
        </TouchableOpacity>

        <Text style={styles.title}>{t('settings.title')}</Text>
        <Text style={styles.sub}>{t('settings.subtitle')}</Text>
        <Text style={styles.hint}>{t('settings.followSystem')}</Text>

        <TouchableOpacity style={styles.deviceRow} onPress={useDevice} activeOpacity={0.85}>
          <Text style={styles.deviceText}>{t('settings.useDeviceLanguage')}</Text>
        </TouchableOpacity>

        <View style={styles.list}>
          {SUPPORTED_APP_LANGUAGES.map((code) => {
            const active = current === code;
            return (
              <TouchableOpacity
                key={code}
                style={[styles.row, active && styles.rowActive]}
                onPress={() => select(code)}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}>
                <Text style={[styles.rowLabel, active && styles.rowLabelActive]}>
                  {t(`settings.names.${code}`)}
                </Text>
                {active ? <Text style={styles.check}>✓</Text> : null}
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#000' },
  scroll: { padding: 20, paddingBottom: 40 },
  back: { alignSelf: 'flex-start', marginBottom: 16 },
  backText: { color: '#d3b275', fontSize: 15, fontWeight: '600' },
  title: { color: '#d3b275', fontSize: 28, fontWeight: 'bold' },
  sub: { color: '#ccc', fontSize: 14, lineHeight: 20, marginTop: 10 },
  hint: { color: '#8a8a8a', fontSize: 12, lineHeight: 17, marginTop: 8, marginBottom: 16 },
  deviceRow: {
    backgroundColor: '#141208',
    borderWidth: 1,
    borderColor: '#3d3420',
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
  },
  deviceText: { color: '#a8a8a8', fontSize: 13, lineHeight: 18 },
  list: { gap: 10 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#111',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  rowActive: { borderColor: '#d3b275', backgroundColor: '#1a1810' },
  rowLabel: { color: '#eee', fontSize: 17, fontWeight: '600' },
  rowLabelActive: { color: '#d3b275' },
  check: { color: '#d3b275', fontSize: 18, fontWeight: '700' },
});
