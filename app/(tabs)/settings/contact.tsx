import { DesignerCreditLine } from '@/components/designer-footer';
import { CHEFAI_CONTACT_EMAIL } from '@/constants/contact';
import { tabScreenScrollPaddingBottom } from '@/constants/tab-screen-scroll-padding';
import { useRouter } from 'expo-router';
import React from 'react';
import {
  Alert,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

function buildMailtoUrl(): string {
  const subject = encodeURIComponent('ChefAI — Contact');
  const body = encodeURIComponent(
    'Hi ChefAI team,\n\n[Your message — suggestion, issue, or question]\n\n'
  );
  return `mailto:${CHEFAI_CONTACT_EMAIL}?subject=${subject}&body=${body}`;
}

export default function SettingsContactScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const onSendEmail = async () => {
    const url = buildMailtoUrl();
    try {
      const supported = await Linking.canOpenURL(url);
      if (!supported) {
        Alert.alert(
          'Email us',
          `No email app found. Write to:\n\n${CHEFAI_CONTACT_EMAIL}`
        );
        return;
      }
      await Linking.openURL(url);
    } catch {
      Alert.alert(
        'Email us',
        `Could not open your email app. Write to:\n\n${CHEFAI_CONTACT_EMAIL}`
      );
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.page}>
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingBottom: tabScreenScrollPaddingBottom(insets.bottom) },
          ]}>
          <TouchableOpacity style={styles.back} onPress={() => router.back()} accessibilityRole="button">
            <Text style={styles.backText}>{t('common.back')}</Text>
          </TouchableOpacity>

          <Text style={styles.title}>Contact us</Text>
          <Text style={styles.sub}>
            Suggestions, problems, or anything you want to ask about ChefAI — we read every message.
          </Text>

          <View style={styles.card}>
            <Text style={styles.cardLabel}>Email</Text>
            <Text style={styles.email} selectable>
              {CHEFAI_CONTACT_EMAIL}
            </Text>
            <Text style={styles.replyNote}>
              We aim to reply within 2–3 business days. Include your device model and what you were
              doing if you are reporting a bug — it helps us fix things faster.
            </Text>
          </View>

          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => void onSendEmail()}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Send email to ChefAI support">
            <Text style={styles.primaryBtnText}>Send email</Text>
          </TouchableOpacity>

          {Platform.OS === 'web' ? (
            <Text style={styles.webHint}>
              On web, copy the address above into your email client if the button does not open one.
            </Text>
          ) : null}

          <DesignerCreditLine />
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const GOLD = '#d3b275';

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#000' },
  page: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingTop: 12 },
  back: { alignSelf: 'flex-start', paddingVertical: 8, marginBottom: 8 },
  backText: { color: GOLD, fontSize: 16, fontWeight: '600' },
  title: { color: GOLD, fontSize: 28, fontWeight: 'bold' },
  sub: { color: '#ccc', fontSize: 14, lineHeight: 20, marginTop: 10, marginBottom: 6 },
  card: {
    marginTop: 18,
    backgroundColor: '#101010',
    borderWidth: 1,
    borderColor: '#2b2b2b',
    borderRadius: 14,
    padding: 16,
  },
  cardLabel: { color: '#888', fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase' },
  email: { color: '#fff', fontSize: 17, fontWeight: '600', marginTop: 10 },
  replyNote: { color: '#9b9b9b', fontSize: 13, lineHeight: 19, marginTop: 14 },
  primaryBtn: {
    marginTop: 18,
    backgroundColor: GOLD,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#000', fontSize: 16, fontWeight: 'bold', letterSpacing: 0.5 },
  webHint: { color: '#666', fontSize: 12, lineHeight: 17, marginTop: 12, textAlign: 'center' },
});
