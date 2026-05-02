import { IconSymbol } from '@/components/ui/icon-symbol';
import { useRouter, useSegments } from 'expo-router';
import React from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const ACTIVE = '#d3b275';
const INACTIVE = '#666666';

/** Approximate footer height for ScrollView / FlatList content padding (+ lift offset) */
export const HOME_EXPLORE_NAV_RESERVED_BOTTOM = 118;

/** Icon + title strip — fixed dock above safe area (stack screens only) */
export function HomeExploreNav() {
  const router = useRouter();
  const segments = useSegments();
  const insets = useSafeAreaInsets();

  const isTabs = segments[0] === '(tabs)';
  const isExploreTab = isTabs && segments[1] === 'explore';
  const isHomeTab = isTabs && !isExploreTab;

  const goHome = () => {
    router.replace('/');
  };
  const goExplore = () => {
    router.replace('/explore');
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
        hitSlop={{ top: 8, bottom: 4, left: 16, right: 16 }}>
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
        hitSlop={{ top: 8, bottom: 4, left: 16, right: 16 }}>
        <IconSymbol name="paperplane.fill" size={26} color={isExploreTab ? ACTIVE : INACTIVE} />
        <Text style={[styles.title, isExploreTab && styles.titleActive]} numberOfLines={1}>
          Explore
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
    paddingHorizontal: 20,
  },
  cell: {
    flex: 1,
    maxWidth: 160,
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
