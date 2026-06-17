import { Platform } from 'react-native';

type AnalyticsParams = Record<string, string | number>;

/**
 * Log a Firebase Analytics custom event. No-ops on web or when the native
 * module is unavailable (Expo Go / old build without Firebase).
 */
export async function logAnalyticsEvent(
  name: string,
  params?: AnalyticsParams
): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    const analytics = (await import('@react-native-firebase/analytics')).default;
    await analytics().logEvent(name, params);
  } catch {
    /* Native Firebase not linked in this binary */
  }
}

/** Fired when a full recipe is generated on Recipe details (not just name ideas). */
export function logRecipeGenerated(params: {
  language: string;
  cuisine: string;
  withImage: boolean;
}): void {
  void logAnalyticsEvent('recipe_generated', {
    language: params.language.slice(0, 40),
    cuisine: params.cuisine.slice(0, 40),
    with_image: params.withImage ? 1 : 0,
  });
}

/** Fired when the user saves a recipe to Explore from Recipe details. */
export function logRecipeSaved(params: { language: string; cuisine: string }): void {
  void logAnalyticsEvent('recipe_saved', {
    language: params.language.slice(0, 40),
    cuisine: params.cuisine.slice(0, 40),
  });
}

/** Fired after Google Play credits are granted on the server. */
export function logCreditsPurchased(params: { productId: string; credits: number }): void {
  void logAnalyticsEvent('credits_purchased', {
    product_id: params.productId.slice(0, 40),
    credits: params.credits,
  });
}
