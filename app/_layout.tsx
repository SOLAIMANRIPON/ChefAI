import { hydrateAppLanguage } from '@/constants/app-language';
import { hydrateTimerSoundPreference } from '@/constants/timer-sound-preference';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [i18nReady, setI18nReady] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    Promise.all([hydrateAppLanguage(), hydrateTimerSoundPreference()]).finally(() => {
      if (!cancelled) setI18nReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!i18nReady) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#d3b275" />
      </View>
    );
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="recipe-list" options={{ headerShown: false }} />
        <Stack.Screen name="recipe-details" options={{ headerShown: false }} />
        <Stack.Screen name="cook-mode" options={{ headerShown: false }} />
        <Stack.Screen name="shopping-lists" options={{ headerShown: false }} />
        <Stack.Screen name="shopping-list" options={{ headerShown: false }} />
        <Stack.Screen name="community-post" options={{ headerShown: false }} />
        <Stack.Screen name="community-share" options={{ headerShown: false }} />
        <Stack.Screen name="settings" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
