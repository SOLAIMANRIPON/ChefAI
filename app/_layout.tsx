import { hydrateAppLanguage } from '@/constants/app-language';
import { hydrateTimerSoundPreference } from '@/constants/timer-sound-preference';
import { configureCookNotificationHandler } from '@/lib/cook-timer-notifications';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [i18nReady, setI18nReady] = React.useState(false);

  React.useEffect(() => {
    if (Platform.OS !== 'web') {
      configureCookNotificationHandler();
    }
  }, []);

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
    <SafeAreaProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="modal" options={{ presentation: 'modal', headerShown: true, title: 'Modal' }} />
        </Stack>
        <StatusBar style="auto" />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
