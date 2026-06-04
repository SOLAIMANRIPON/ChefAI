/** Public Play Store listing — appended to every recipe shared from the app. */
export const PLAY_STORE_LISTING_URL =
  'https://play.google.com/store/apps/details?id=com.solaiman.chefai';

export const RECIPE_SHARE_PLAY_STORE_FOOTER = `\n\n📲 Download on Google Play\n\n${PLAY_STORE_LISTING_URL}`;

/** Recipe share text + Play Store CTA (social / clipboard). */
export function appendPlayStoreFooterToRecipeShare(recipeBody: string): string {
  const trimmed = recipeBody.trimEnd();
  return `${trimmed}${RECIPE_SHARE_PLAY_STORE_FOOTER}`;
}
