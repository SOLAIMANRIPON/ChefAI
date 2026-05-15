import * as FileSystem from 'expo-file-system/legacy';
import { EncodingType } from 'expo-file-system/legacy';
import { Platform } from 'react-native';

export const RECIPE_COVER_DIR = 'chefai-recipe-covers';

/** Hard cap on data-URL string length (base64 inflates quickly). */
const MAX_DATA_URL_CHARS = 28_000_000;

/** Short http(s) URLs only — same limits as saved-recipes `imageUrl` storage. */
export function persistableHttpImageUrl(url: string): string {
  const u = url.trim();
  if (!u || u.startsWith('data:') || u.length > 8000) return '';
  if (/^https?:\/\//i.test(u)) return u;
  return '';
}

function parseDataImageBase64(dataUrl: string): { payload: string; ext: string } | null {
  const u = dataUrl.trim();
  if (!u.startsWith('data:') || u.length > MAX_DATA_URL_CHARS) return null;
  const comma = u.indexOf(',');
  if (comma === -1) return null;
  const header = u.slice(0, comma).toLowerCase();
  const body = u.slice(comma + 1).replace(/\s/g, '');
  if (!header.includes(';base64') || !body) return null;

  let ext = 'png';
  if (header.includes('image/jpeg') || header.includes('image/jpg')) ext = 'jpg';
  else if (header.includes('image/webp')) ext = 'webp';
  else if (header.includes('image/png')) ext = 'png';

  return { payload: body, ext };
}

function coversRootUri(): string | null {
  const base = FileSystem.documentDirectory;
  if (!base) return null;
  return `${base}${RECIPE_COVER_DIR}/`;
}

function isAlreadyPersistedCover(sourceUri: string, recipeId: string): string | null {
  const root = coversRootUri();
  if (!root) return null;
  const safeId = recipeId.replace(/[^a-z0-9_-]/gi, '_').slice(0, 80);
  const u = sourceUri.trim();
  if (!u.startsWith('file')) return null;
  if (!u.includes(`${RECIPE_COVER_DIR}/${safeId}.`)) return null;
  return u;
}

/**
 * Resolves `imageUrl` for persistence: short https URLs, base64 data URLs → file on disk,
 * copies other local URIs (content/file) into app document storage.
 */
export async function resolveRecipeCoverForSave(sourceUri: string, recipeId: string): Promise<string> {
  const raw = sourceUri.trim();
  if (!raw) return '';

  const http = persistableHttpImageUrl(raw);
  if (http) return http;

  if (Platform.OS === 'web') return '';

  const base = FileSystem.documentDirectory;
  if (!base) return '';

  const safeId = recipeId.replace(/[^a-z0-9_-]/gi, '_').slice(0, 80);
  const existing = isAlreadyPersistedCover(raw, recipeId);
  if (existing) return existing;

  const dir = `${base}${RECIPE_COVER_DIR}/`;
  await FileSystem.makeDirectoryAsync(dir, { intermediates: true });

  if (raw.startsWith('data:')) {
    const parsed = parseDataImageBase64(raw);
    if (!parsed) return '';
    const dest = `${dir}${safeId}.${parsed.ext}`;
    try {
      await FileSystem.writeAsStringAsync(dest, parsed.payload, { encoding: EncodingType.Base64 });
      return dest;
    } catch {
      return '';
    }
  }

  const dest = `${dir}${safeId}.jpg`;
  try {
    await FileSystem.copyAsync({ from: raw, to: dest });
  } catch {
    return '';
  }
  return dest;
}

/**
 * Returns a `file://` or `content://` URI suitable for `MediaLibrary.saveToLibraryAsync`.
 * Data URLs are written to the app cache directory first.
 */
export async function ensureLocalImageFileForGallery(sourceUri: string): Promise<string | null> {
  const raw = sourceUri.trim();
  if (!raw || Platform.OS === 'web') return null;

  if (raw.startsWith('data:')) {
    const parsed = parseDataImageBase64(raw);
    if (!parsed) return null;
    const cache = FileSystem.cacheDirectory;
    if (!cache) return null;
    const dest = `${cache}chefai-gallery-export-${Date.now()}.${parsed.ext}`;
    try {
      await FileSystem.writeAsStringAsync(dest, parsed.payload, { encoding: EncodingType.Base64 });
      return dest;
    } catch {
      return null;
    }
  }

  if (raw.startsWith('file://') || raw.startsWith('content://') || raw.startsWith('ph://')) {
    return raw;
  }
  return null;
}

/**
 * Local `file://` path for sharing the dish photo (expo-sharing / attach to social apps).
 * Writes data URLs to cache, downloads short https URLs, copies content/ph URIs to cache.
 */
export async function ensureShareableRecipeImage(sourceUri: string): Promise<string | null> {
  const raw = sourceUri.trim();
  if (!raw || Platform.OS === 'web') return null;

  if (raw.startsWith('data:')) {
    return ensureLocalImageFileForGallery(raw);
  }

  const http = persistableHttpImageUrl(raw);
  if (http) {
    const cache = FileSystem.cacheDirectory;
    if (!cache) return null;
    const dest = `${cache}chefai-share-dl-${Date.now()}.jpg`;
    try {
      const { uri } = await FileSystem.downloadAsync(http, dest);
      return uri || dest;
    } catch {
      return null;
    }
  }

  if (raw.startsWith('file://')) {
    return raw;
  }

  if (raw.startsWith('content://') || raw.startsWith('ph://')) {
    const cache = FileSystem.cacheDirectory;
    if (!cache) return null;
    const dest = `${cache}chefai-share-import-${Date.now()}.jpg`;
    try {
      await FileSystem.copyAsync({ from: raw, to: dest });
      return dest;
    } catch {
      return null;
    }
  }

  return null;
}
