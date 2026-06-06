/** Reject non-Latin error copy (e.g. accidental Bangla) before showing to the user. */
const NON_ENGLISH_SCRIPT = /[\u0980-\u09FF\u0900-\u097F\u0600-\u06FF]/;

/**
 * User-visible error copy is always English (all screens and recipe languages).
 */
export const APP_ERRORS = {
  apiBaseUrlMissing:
    'Server URL is not configured. Set EXPO_PUBLIC_API_BASE_URL in your environment.',
  recipeLoadFailed: 'Could not load the recipe. Please try again.',
  imageIngredientsFailed: 'Could not detect ingredients from the photo. Please try again.',
  connectionTimeout:
    'The server took too long or the connection timed out. Check your network and try again.',
  imageLoadFailed: 'Image could not load.',
  recipeIdMissing: 'Recipe ID missing.',
  recipeNotFound: 'Recipe not found. Please pick a saved recipe first.',
  recipeEmpty: 'Recipe is empty — cannot build a shopping list.',
  loadFailed: 'Failed to load.',
  noRecipeText: 'No recipe text available.',
  shoppingListBuildServer:
    'Could not build the list. Update the backend, or make sure the recipe lists ingredients with quantities.',
  shoppingListBuildNoApiBase:
    'Could not build the list. Check your connection or add more ingredient detail to the recipe.',
  saveFailedTitle: 'Save failed',
  saveFailedBody: 'Could not save right now. Please try again.',
  saveCoverCopyFailed:
    'Could not copy your cover photo to app storage. Check photo permission or storage, then try again.',
  imageRecognitionTimeout: 'Image recognition timed out. Please try again.',
  noStepTimeStatus: 'No step time found for timer',
  voiceUnavailable: 'Voice commands unavailable. Install the app from Google Play.',
  micPermissionOff: 'Microphone permission is off. Voice commands are disabled.',
  voiceNeedsDevBuild: 'Voice commands unavailable. Open from Google Play, not Expo Go.',
  micPermissionNeededTitle: 'Microphone permission needed',
  micPermissionNeededBody:
    'Allow microphone access in Android Settings → Apps → ChefAI → Permissions to use voice commands in Cook Mode.',
  bnVoiceMissingTitle: 'Required TTS voice missing',
  bnVoiceMissingBody:
    'Install a voice for this language in Settings → Text-to-speech output → Google → Install voice data.',
  dietConflictTitle: 'Diet and ingredient mismatch',
  dietConflictVegetarian:
    'You chose Vegetarian, but your text suggests meat or seafood. What would you like to do?',
  dietConflictVeganFlesh:
    'You chose Vegan, but your text suggests meat or seafood. What would you like to do?',
  dietConflictVeganAnimal:
    'You chose Vegan, but your text suggests dairy, eggs, honey, or other animal products. What would you like to do?',
  dietConflictGluten:
    'You chose Gluten-free, but your text suggests wheat flour or other gluten sources. What would you like to do?',
  communityPermissionTitle: 'Permission needed',
  communityPermissionBody:
    'Allow photo library access so you can pick a picture from your gallery.',
  communityMissingTitle: 'Missing info',
  communityMissingBody: 'Please enter a dish name.',
  communityPhotoTitle: 'Photo required',
  communityPhotoBody: 'Choose a photo to share with the community.',
  communitySaveFailTitle: 'Could not save',
  communitySaveFailBody: 'Please try again.',
} as const;

/** Prefer a known English fallback when the caught error message is not safe to show. */
export function userFacingError(error: unknown, fallback: string): string {
  if (error instanceof Error) {
    const message = error.message.trim();
    if (message && !NON_ENGLISH_SCRIPT.test(message)) return message;
  }
  return fallback;
}
