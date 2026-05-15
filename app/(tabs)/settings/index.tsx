import { DesignerCreditLine } from '@/components/designer-footer';
import { tabScreenScrollPaddingBottom } from '@/constants/tab-screen-scroll-padding';
import { useRouter } from 'expo-router';
import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

export default function SettingsHubScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.page}>
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: tabScreenScrollPaddingBottom(insets.bottom) }]}>
          <Text style={styles.title}>{t('settings.title')}</Text>
          <Text style={styles.sub}>{t('settings.subtitle')}</Text>

          <TouchableOpacity
            style={styles.menuCard}
            onPress={() => router.push('/settings/profile')}
            activeOpacity={0.85}
            accessibilityRole="button">
            <Text style={styles.menuTitle}>Profile</Text>
            <Text style={styles.menuDesc}>Name, diet, cooking level, allergies, and save.</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuCard}
            onPress={() => router.push('/settings/timer')}
            activeOpacity={0.85}
            accessibilityRole="button">
            <Text style={styles.menuTitle}>Timer alarm</Text>
            <Text style={styles.menuDesc}>Sound when a cook-mode timer ends — presets or your own file.</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuCard}
            onPress={() => router.push('/settings/help')}
            activeOpacity={0.85}
            accessibilityRole="button">
            <Text style={styles.menuTitle}>Help</Text>
            <Text style={styles.menuDesc}>How to use ChefAI, FAQ, and tips — ChefAI only.</Text>
          </TouchableOpacity>

          <DesignerCreditLine />
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#000' },
  page: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingTop: 20 },
  title: { color: '#d3b275', fontSize: 28, fontWeight: 'bold' },
  sub: { color: '#ccc', fontSize: 14, lineHeight: 20, marginTop: 10, marginBottom: 6 },
  menuCard: {
    marginTop: 14,
    backgroundColor: '#101010',
    borderWidth: 1,
    borderColor: '#2b2b2b',
    borderRadius: 14,
    padding: 16,
  },
  menuTitle: { color: '#d3b275', fontSize: 18, fontWeight: '700' },
  menuDesc: { color: '#9b9b9b', fontSize: 13, lineHeight: 19, marginTop: 8 },
});
