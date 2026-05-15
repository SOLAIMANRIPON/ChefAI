import { IconSymbol } from '@/components/ui/icon-symbol';
import { useRouter, useSegments } from 'expo-router';
import React from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const ACTIVE = '#d3b275';
const INACTIVE = '#666666';

/** Approximate footer height for ScrollView / FlatList content padding (+ lift offset) */
export const HOME_EXPLORE_NAV_RESERVED_BOTTOM = 132;

/** Bottom strip: Home + Explore + Settings (matches tab bar). */
export function HomeExploreNav() {
  const router = useRouter();
  const segments = useSegments();
  const insets = useSafeAreaInsets();

  const segs = segments as string[];
  const isTabs = segs[0] === '(tabs)';
  const tabName = segs[1];
  const isHomeTab = isTabs && (tabName === 'index' || tabName === undefined);
  const isExploreTab = isTabs && tabName === 'explore';
  const isSettingsTab = isTabs && tabName === 'settings';

  const goHome = () => {
    router.replace('/');
  };
  const goExplore = () => {
    router.replace('/explore');
  };
  const goSettings = () => {
    router.replace('/settings');
  };

  const safeBottom = Math.max(insets.bottom, Platform.OS === 'android' ? 14 : 10);
  const paddingBottom = safeBottom + (Platform.OS === 'android' ? 18 : 10);

  return (
    <View style={[styles.bar, { paddingBottom, marginBottom: 15 }]} accessibilityRole="toolbar">
      <TouchableOpacity
        style={styles.cell}
        onPress={goHome}
        accessibilityRole="button"
        accessibilityState={{ selected: isHomeTab }}
        accessibilityLabel="Home"
        hitSlop={{ top: 8, bottom: 4, left: 12, right: 12 }}>
        <IconSymbol name="house.fill" size={26} color={isHomeTab ? ACTIVE : INACTIVE} />
        <Text style={[styles.title, isHomeTab && styles.titleActive]} numberOfLines={1}>
          Home
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.cell}
        onPress={goExplore}
        accessibilityRole="button"
        accessibilityState={{ selected: isExploreTab }}
        accessibilityLabel="Explore"
        hitSlop={{ top: 8, bottom: 4, left: 12, right: 12 }}>
        <IconSymbol name="paperplane.fill" size={26} color={isExploreTab ? ACTIVE : INACTIVE} />
        <Text style={[styles.title, isExploreTab && styles.titleActive]} numberOfLines={1}>
          Explore
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.cell}
        onPress={goSettings}
        accessibilityRole="button"
        accessibilityState={{ selected: isSettingsTab }}
        accessibilityLabel="Settings"
        hitSlop={{ top: 8, bottom: 4, left: 12, right: 12 }}>
        <IconSymbol name="gearshape.fill" size={26} color={isSettingsTab ? ACTIVE : INACTIVE} />
        <Text style={[styles.title, isSettingsTab && styles.titleActive]} numberOfLines={1}>
          Settings
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    borderTopWidth: 1,
    borderTopColor: '#1a1a1a',
    backgroundColor: '#050505',
    paddingTop: 8,
    paddingHorizontal: 12,
  },
  cell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingBottom: 4,
  },
  title: {
    marginTop: 4,
    fontSize: 11,
    fontWeight: '600',
    color: INACTIVE,
    letterSpacing: 0.3,
  },
  titleActive: {
    color: ACTIVE,
  },
});
