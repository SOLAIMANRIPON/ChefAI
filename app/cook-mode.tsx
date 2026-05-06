import { DesignerCreditLine } from '@/components/designer-footer';
import { HOME_EXPLORE_NAV_RESERVED_BOTTOM, HomeExploreNav } from '@/components/home-explore-nav';
import { clearCookModeSession, loadCookModeSession } from '@/constants/cook-mode-session';
import {
  cancelCookTimerNotification,
  scheduleCookTimerNotification,
} from '@/lib/cook-timer-notifications';
import { extractMinutesFromStep, parseRecipeSteps } from '@/lib/recipe-steps';
import { playTimerDoneSound } from '@/lib/timer-alarm';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const GOLD = '#d3b275';
const TIMER_STICKY_MIN_HEIGHT = 56;
const PADDING_BOTTOM_EXTRA = 24;

function formatMmSs(totalSeconds: number) {
  const safe = Math.max(0, totalSeconds);
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function truncateLabel(text: string, max = 42) {
  const t = text.trim().replace(/\s+/g, ' ');
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

export default function CookModeScreen() {
  const router = useRouter();
  const [dishName, setDishName] = React.useState('');
  const [steps, setSteps] = React.useState<string[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [currentIndex, setCurrentIndex] = React.useState(0);
  const [done, setDone] = React.useState<boolean[]>([]);

  const [customMinutes, setCustomMinutes] = React.useState('5');

  const [timerLabel, setTimerLabel] = React.useState('');
  const [remainingSeconds, setRemainingSeconds] = React.useState(0);
  const [timerStatus, setTimerStatus] = React.useState<'idle' | 'running' | 'paused'>('idle');
  const [finishedBanner, setFinishedBanner] = React.useState(false);

  const intervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const scheduledNotificationIdRef = React.useRef<string | null>(null);
  const remainingSecondsRef = React.useRef(0);

  remainingSecondsRef.current = remainingSeconds;

  const syncCookTimerNotification = React.useCallback(
    async (fireAtMs: number, dish: string, label: string) => {
      await cancelCookTimerNotification(scheduledNotificationIdRef.current);
      scheduledNotificationIdRef.current = null;
      const id = await scheduleCookTimerNotification({
        fireAtMs,
        dishName: dish,
        stepLabel: label,
      });
      if (id) scheduledNotificationIdRef.current = id;
    },
    []
  );

  React.useEffect(() => {
    let cancelled = false;
    loadCookModeSession().then((session) => {
      if (cancelled) return;
      if (!session?.recipe?.trim()) {
        router.back();
        return;
      }
      const parsed = parseRecipeSteps(session.recipe);
      setDishName(session.dishName?.trim() || 'Recipe');
      setSteps(parsed.length ? parsed : [session.recipe.trim()]);
      setDone(parsed.map(() => false));
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [router]);

  React.useEffect(() => {
    return () => {
      void clearCookModeSession();
      if (intervalRef.current) clearInterval(intervalRef.current);
      void cancelCookTimerNotification(scheduledNotificationIdRef.current);
      scheduledNotificationIdRef.current = null;
    };
  }, []);

  React.useEffect(() => {
    if (timerStatus !== 'running') {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }
    intervalRef.current = setInterval(() => {
      setRemainingSeconds((r) => {
        if (r <= 1) {
          void cancelCookTimerNotification(scheduledNotificationIdRef.current);
          scheduledNotificationIdRef.current = null;
          setTimerStatus('idle');
          setFinishedBanner(true);
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          void playTimerDoneSound();
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [timerStatus]);

  const stepCount = steps.length;
  const safeIndex = stepCount ? Math.min(currentIndex, stepCount - 1) : 0;
  const currentStepText = steps[safeIndex] ?? '';
  const suggestedMinutes = extractMinutesFromStep(currentStepText);

  const timerStripVisible =
    timerStatus === 'running' || timerStatus === 'paused' || finishedBanner || remainingSeconds > 0;

  const stopTimerFully = () => {
    void cancelCookTimerNotification(scheduledNotificationIdRef.current);
    scheduledNotificationIdRef.current = null;
    setTimerStatus('idle');
    setRemainingSeconds(0);
    setFinishedBanner(false);
    setTimerLabel('');
  };

  const startTimerSeconds = (seconds: number, label: string) => {
    const bounded = Math.min(24 * 3600, Math.max(1, Math.round(seconds)));
    setTimerLabel(label);
    setRemainingSeconds(bounded);
    setFinishedBanner(false);
    setTimerStatus('running');
    const fireAt = Date.now() + bounded * 1000;
    void syncCookTimerNotification(fireAt, dishName, label);
  };

  const togglePauseResume = React.useCallback(() => {
    setTimerStatus((prev) => {
      if (prev === 'running') {
        void cancelCookTimerNotification(scheduledNotificationIdRef.current);
        scheduledNotificationIdRef.current = null;
        return 'paused';
      }
      if (prev === 'paused') {
        const r = Math.max(1, remainingSecondsRef.current);
        const fireAt = Date.now() + r * 1000;
        const label =
          timerLabel.trim() || truncateLabel(currentStepText, 42);
        void syncCookTimerNotification(fireAt, dishName, label);
        return 'running';
      }
      return prev;
    });
  }, [dishName, timerLabel, currentStepText, syncCookTimerNotification]);

  const addOneMinute = React.useCallback(() => {
    if (timerStatus !== 'running') return;
    setRemainingSeconds((r) => {
      const next = r + 60;
      const fireAt = Date.now() + next * 1000;
      const label =
        timerLabel.trim() || truncateLabel(currentStepText, 42);
      void syncCookTimerNotification(fireAt, dishName, label);
      return next;
    });
  }, [timerStatus, dishName, timerLabel, currentStepText, syncCookTimerNotification]);

  const parseCustomMinutes = (): number | null => {
    const n = Number.parseInt(customMinutes.trim(), 10);
    if (!Number.isFinite(n)) return null;
    return Math.min(240, Math.max(1, n));
  };

  const handleBack = () => {
    if (timerStatus === 'running' || timerStatus === 'paused') {
      Alert.alert('টাইমার চলছে', 'টাইমার থামিয়ে বের হবেন?', [
        { text: 'থাকুন', style: 'cancel' },
        {
          text: 'বের হোন',
          style: 'destructive',
          onPress: () => {
            stopTimerFully();
            router.back();
          },
        },
      ]);
      return;
    }
    router.back();
  };

  const toggleDoneAt = (index: number) => {
    setDone((prev) => {
      const next = [...prev];
      next[index] = !next[index];
      return next;
    });
  };

  const markCurrentDoneAndAdvance = () => {
    setDone((prev) => {
      const next = [...prev];
      next[safeIndex] = true;
      return next;
    });
    if (safeIndex < stepCount - 1) setCurrentIndex(safeIndex + 1);
  };

  const scrollBottomPad =
    20 + HOME_EXPLORE_NAV_RESERVED_BOTTOM + (timerStripVisible ? TIMER_STICKY_MIN_HEIGHT + 8 : 0) + PADDING_BOTTOM_EXTRA;

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingBox}>
          <Text style={styles.loadingText}>লোড হচ্ছে…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.page}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: scrollBottomPad }]}>
          <TouchableOpacity style={styles.backBtn} onPress={handleBack} accessibilityRole="button">
            <Text style={styles.backBtnText}>← ফিরে যান</Text>
          </TouchableOpacity>

          <Text style={styles.screenTitle}>কুক মোড</Text>
          <Text style={styles.dishTitle} numberOfLines={2}>
            {dishName}
          </Text>

          <Text style={styles.progressLine}>
            ধাপ {safeIndex + 1} / {stepCount}
          </Text>

          <View style={styles.stepCard}>
            <Text style={styles.stepBody}>{currentStepText}</Text>
          </View>

          <View style={styles.navRow}>
            <TouchableOpacity
              style={[styles.secondaryBtn, safeIndex === 0 && styles.secondaryBtnDisabled]}
              disabled={safeIndex === 0}
              onPress={() => setCurrentIndex((i) => Math.max(0, i - 1))}>
              <Text style={[styles.secondaryBtnText, safeIndex === 0 && styles.secondaryBtnTextDisabled]}>আগের ধাপ</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.secondaryBtn, safeIndex >= stepCount - 1 && styles.secondaryBtnDisabled]}
              disabled={safeIndex >= stepCount - 1}
              onPress={() => setCurrentIndex((i) => Math.min(stepCount - 1, i + 1))}>
              <Text
                style={[styles.secondaryBtnText, safeIndex >= stepCount - 1 && styles.secondaryBtnTextDisabled]}>
                পরের ধাপ
              </Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.donePrimary} onPress={markCurrentDoneAndAdvance} activeOpacity={0.85}>
            <MaterialIcons name="check-circle" size={22} color="#000" />
            <Text style={styles.donePrimaryText}>এই ধাপ শেষ</Text>
          </TouchableOpacity>

          <Text style={styles.sectionLabel}>টাইমার</Text>
          <View style={styles.timerCard}>
            {suggestedMinutes != null ? (
              <TouchableOpacity
                style={styles.suggestBtn}
                onPress={() =>
                  startTimerSeconds(suggestedMinutes * 60, truncateLabel(currentStepText))
                }>
                <MaterialIcons name="timer" size={20} color="#000" />
                <Text style={styles.suggestBtnText}>{suggestedMinutes} মিনিট শুরু</Text>
              </TouchableOpacity>
            ) : (
              <Text style={styles.suggestHint}>এই ধাপে সময় উল্লেখ নেই—নিচে মিনিট লিখে শুরু করুন।</Text>
            )}

            <View style={styles.customRow}>
              <Text style={styles.customLabel}>মিনিট</Text>
              <TextInput
                value={customMinutes}
                onChangeText={setCustomMinutes}
                keyboardType="number-pad"
                placeholder="5"
                placeholderTextColor="#666"
                style={styles.customInput}
              />
              <TouchableOpacity
                style={styles.customStart}
                onPress={() => {
                  const m = parseCustomMinutes();
                  if (m == null) return;
                  startTimerSeconds(m * 60, truncateLabel(currentStepText));
                }}>
                <Text style={styles.customStartText}>শুরু</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.presetRow}>
              {[3, 5, 10, 15].map((m) => (
                <TouchableOpacity
                  key={m}
                  style={styles.presetChip}
                  onPress={() => startTimerSeconds(m * 60, truncateLabel(currentStepText))}>
                  <Text style={styles.presetChipText}>{m} মি</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <Text style={styles.sectionLabel}>চেকলিস্ট</Text>
          <View style={styles.checklist}>
            {steps.map((line, i) => {
              const isCurrent = i === safeIndex;
              return (
                <TouchableOpacity
                  key={`step-${i}`}
                  style={[styles.checkRow, isCurrent && styles.checkRowCurrent]}
                  onPress={() => setCurrentIndex(i)}
                  activeOpacity={0.85}>
                  <TouchableOpacity
                    style={styles.checkHit}
                    onPress={() => toggleDoneAt(i)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: !!done[i] }}>
                    <MaterialIcons
                      name={done[i] ? 'check-box' : 'check-box-outline-blank'}
                      size={26}
                      color={done[i] ? GOLD : '#666'}
                    />
                  </TouchableOpacity>
                  <Text style={[styles.checkText, done[i] && styles.checkTextDone]} numberOfLines={3}>
                    {line}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <DesignerCreditLine />
        </ScrollView>

        {timerStripVisible ? (
          <View style={styles.timerSticky}>
            {finishedBanner ? (
              <View style={styles.timerStickyInner}>
                <MaterialIcons name="notifications-active" size={22} color={GOLD} />
                <Text style={styles.timerStickyTitle}>সময় শেষ</Text>
                <TouchableOpacity style={styles.timerStickyDismiss} onPress={stopTimerFully}>
                  <Text style={styles.timerStickyDismissText}>বন্ধ</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.timerStickyInner}>
                <View style={styles.timerStickyLeft}>
                  <Text style={styles.timerStickyLabel} numberOfLines={1}>
                    {timerLabel || truncateLabel(currentStepText, 36)}
                  </Text>
                  <Text style={styles.timerStickyClock}>{formatMmSs(remainingSeconds)}</Text>
                </View>
                <View style={styles.timerStickyActions}>
                  <TouchableOpacity style={styles.timerIconBtn} onPress={togglePauseResume}>
                    <MaterialIcons
                      name={timerStatus === 'running' ? 'pause' : 'play-arrow'}
                      size={28}
                      color={GOLD}
                    />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.timerIconBtn} onPress={addOneMinute}>
                    <Text style={styles.plusOneText}>+১ মি</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.timerIconBtn} onPress={stopTimerFully}>
                    <MaterialIcons name="stop" size={26} color="#c77" />
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        ) : null}

        <HomeExploreNav />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  page: { flex: 1 },
  loadingBox: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: GOLD, fontSize: 16 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 8, alignItems: 'stretch' },
  backBtn: { alignSelf: 'flex-start', marginBottom: 10 },
  backBtnText: { color: GOLD, fontSize: 15, fontWeight: '600' },
  screenTitle: { color: '#888', fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 4 },
  dishTitle: { color: GOLD, fontSize: 22, fontWeight: 'bold', marginBottom: 6 },
  progressLine: { color: '#aaa', fontSize: 14, marginBottom: 14 },
  stepCard: {
    backgroundColor: '#111',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    marginBottom: 14,
  },
  stepBody: { color: '#e8e8e8', fontSize: 17, lineHeight: 26 },
  navRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  secondaryBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#333',
    backgroundColor: '#0d0d0d',
    alignItems: 'center',
  },
  secondaryBtnDisabled: { opacity: 0.35 },
  secondaryBtnText: { color: GOLD, fontWeight: '600', fontSize: 14 },
  secondaryBtnTextDisabled: { color: '#555' },
  donePrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: GOLD,
    paddingVertical: 14,
    borderRadius: 14,
    marginBottom: 22,
  },
  donePrimaryText: { color: '#000', fontSize: 16, fontWeight: 'bold' },
  sectionLabel: {
    color: '#777',
    fontSize: 11,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  timerCard: {
    backgroundColor: '#101010',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#252525',
    marginBottom: 22,
  },
  suggestBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: GOLD,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 12,
  },
  suggestBtnText: { color: '#000', fontWeight: 'bold', fontSize: 15 },
  suggestHint: { color: '#9a9a9a', fontSize: 13, marginBottom: 12, lineHeight: 20 },
  customRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  customLabel: { color: '#aaa', fontSize: 14 },
  customInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#fff',
    fontSize: 16,
    backgroundColor: '#080808',
  },
  customStart: {
    backgroundColor: '#222',
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: GOLD,
  },
  customStartText: { color: GOLD, fontWeight: '700' },
  presetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  presetChip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#333',
  },
  presetChipText: { color: '#ddd', fontSize: 13 },
  checklist: { gap: 8, marginBottom: 20 },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#0c0c0c',
    borderWidth: 1,
    borderColor: '#1f1f1f',
  },
  checkRowCurrent: { borderColor: GOLD, backgroundColor: '#141008' },
  checkHit: { paddingTop: 2 },
  checkText: { flex: 1, color: '#ddd', fontSize: 14, lineHeight: 20 },
  checkTextDone: { color: '#666', textDecorationLine: 'line-through' },
  timerSticky: {
    borderTopWidth: 1,
    borderTopColor: '#222',
    backgroundColor: '#070707',
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: TIMER_STICKY_MIN_HEIGHT,
    justifyContent: 'center',
  },
  timerStickyInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  timerStickyLeft: { flex: 1 },
  timerStickyLabel: { color: '#9a9a9a', fontSize: 12, marginBottom: 4 },
  timerStickyClock: { color: GOLD, fontSize: 26, fontWeight: 'bold', fontVariant: ['tabular-nums'] },
  timerStickyActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  timerIconBtn: { padding: 8 },
  plusOneText: { color: GOLD, fontWeight: '700', fontSize: 13 },
  timerStickyTitle: { flex: 1, color: GOLD, fontWeight: '700', fontSize: 16 },
  timerStickyDismiss: {
    backgroundColor: '#222',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#444',
  },
  timerStickyDismissText: { color: '#eee', fontWeight: '600' },
});
