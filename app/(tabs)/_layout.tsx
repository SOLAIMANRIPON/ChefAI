import { Tabs } from 'expo-router';
import React from 'react';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconSymbol } from '@/components/ui/icon-symbol';

/** Extra lift so Home/Explore stay above Android 3-button / gesture nav */
function useTabBarBottomPadding(): number {
  const insets = useSafeAreaInsets();
  const base = Math.max(insets.bottom, Platform.OS === 'android' ? 12 : 8);
  const lift = Platform.OS === 'android' ? 22 : 14;
  return base + lift;
}

export default function TabLayout() {
  const tabPadBottom = useTabBarBottomPadding();
  const tabBarHeight = 52 + tabPadBottom + 12;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#d3b275',
        tabBarInactiveTintColor: '#666666',
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#000000',
          borderTopWidth: 0,
          height: tabBarHeight,
          paddingBottom: tabPadBottom,
          paddingTop: 12,
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="house.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Explore',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="paperplane.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="gearshape.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="community"
        options={{
          title: 'Community',
          href: null,
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="person.3.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="craft"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
