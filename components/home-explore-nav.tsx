import { IconSymbol } from '@/components/ui/icon-symbol';
import { useRouter, useSegments } from 'expo-router';
import React from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const ACTIVE = '#d3b275';
const INACTIVE = '#666666';

/** Approximate footer height for ScrollView / FlatList content padding (+ lift offset) */
export const HOME_EXPLORE_NAV_RESERVED_BOTTOM = 124;

/** Bottom strip matching main tab bar (Home, Explore, Community) — used on stack screens above tabs */
export function HomeExploreNav() {
  const router = useRouter();
  const segments = useSegments();
  const insets = useSafeAreaInsets();

  const isTabs = segments[0] === '(tabs)';
  const tabName = segments[1];
  const isHomeTab = isTabs && (tabName === 'index' || tabName === undefined);
  const isExploreTab = isTabs && tabName === 'explore';
  const isCommunityTab = isTabs && tabName === 'community';

  const goHome = () => {
    router.replace('/');
  };
  const goExplore = () => {
    router.replace('/explore');
  };
  const goCommunity = () => {
    router.replace('/community');
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
        onPress={goCommunity}
        accessibilityRole="button"
        accessibilityState={{ selected: isCommunityTab }}
        accessibilityLabel="Community"
        hitSlop={{ top: 8, bottom: 4, left: 12, right: 12 }}>
        <IconSymbol name="person.3.fill" size={26} color={isCommunityTab ? ACTIVE : INACTIVE} />
        <Text style={[styles.title, isCommunityTab && styles.titleActive]} numberOfLines={1}>
          Community
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
