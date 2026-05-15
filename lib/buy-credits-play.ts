import { CHEFAI_INSTALL_HEADER, type RecipeBillingSnapshot } from '@/constants/chefai-billing';
import { getPlayCreditPackSkus } from '@/constants/play-credit-packs';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import {
  ErrorCode,
  type Purchase,
  endConnection,
  fetchProducts,
  finishTransaction,
  initConnection,
  purchaseErrorListener,
  purchaseUpdatedListener,
  requestPurchase,
} from 'react-native-iap';

function resolveAndroidPackageName(fallback: string): string {
  const fromExpo = Constants.expoConfig?.android?.package;
  return typeof fromExpo === 'string' && fromExpo.trim() ? fromExpo.trim() : fallback;
}

/** All consumable SKUs (comma list env overrides pack order). */
export function getCreditsProductSkus(): string[] {
  const raw = process.env.EXPO_PUBLIC_PLAY_CREDITS_PRODUCT_IDS?.trim();
  if (raw) {
    const ids = raw
      .split(',')
      .map((s: string) => s.trim())
      .filter(Boolean);
    if (ids.length) return ids;
  }
  const legacy = process.env.EXPO_PUBLIC_PLAY_CREDITS_PRODUCT_ID?.trim();
  if (legacy) return [legacy];
  return getPlayCreditPackSkus();
}

export async function purchaseCreditsWithGooglePlay(params: {
  apiBaseUrl: string;
  installId: string;
  productSku: string;
}): Promise<RecipeBillingSnapshot> {
  if (Platform.OS === 'web') {
    throw new Error('Credit purchases are not available in the web build.');
  }
  if (Platform.OS !== 'android') {
    throw new Error('Credit purchases use Google Play on Android.');
  }

  const productSku = params.productSku.trim();
  if (!productSku) {
    throw new Error('No credit pack selected.');
  }

  const packageName = resolveAndroidPackageName(
    process.env.EXPO_PUBLIC_PLAY_ANDROID_PACKAGE_NAME || 'com.solaiman.chefai'
  );

  await initConnection();

  try {
    const allSkus = getCreditsProductSkus();
    const skusToFetch = allSkus.includes(productSku) ? allSkus : [...allSkus, productSku];
    const items = await fetchProducts({ skus: skusToFetch, type: 'in-app' });
    const found = items?.some((p) => p.id === productSku || (p as { productId?: string }).productId === productSku);
    if (!items || items.length === 0 || !found) {
      throw new Error(
        `Play Store did not return product "${productSku}". Create all packs in Play Console and set EXPO_PUBLIC_PLAY_CREDITS_PRODUCT_IDS.`
      );
    }

    const purchase = await new Promise<Purchase>((resolve, reject) => {
      let settled = false;

      const cleanup = (fn: () => void) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        subUp.remove();
        subErr.remove();
        fn();
      };

      const timeout = setTimeout(() => {
        cleanup(() =>
          reject(new Error('Purchase timed out. If you already paid, tap Buy credits again to retry.'))
        );
      }, 120_000);

      const subUp = purchaseUpdatedListener((p) => {
        if (p.productId !== productSku) return;
        cleanup(() => resolve(p));
      });

      const subErr = purchaseErrorListener((err) => {
        const cancelled =
          err.code === ErrorCode.UserCancelled ||
          String(err.code || '').toUpperCase().includes('USER_CANCELLED');
        cleanup(() =>
          reject(cancelled ? new Error('Purchase cancelled.') : new Error(err.message || 'Purchase failed.'))
        );
      });

      requestPurchase({
        request: {
          google: { skus: [productSku] },
        },
        type: 'in-app',
      }).catch((e: unknown) => {
        cleanup(() => reject(e instanceof Error ? e : new Error(String(e))));
      });
    });

    const token =
      typeof purchase.purchaseToken === 'string' && purchase.purchaseToken.trim()
        ? purchase.purchaseToken.trim()
        : '';

    if (!token) {
      throw new Error('Missing purchase token from Google Play.');
    }

    const base = params.apiBaseUrl.replace(/\/$/, '');
    const res = await fetch(`${base}/api/v1/billing/google-play/grant-credits`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        [CHEFAI_INSTALL_HEADER]: params.installId,
      },
      body: JSON.stringify({
        productId: productSku,
        purchaseToken: token,
        packageName,
      }),
    });

    let payload: { message?: string; billing?: RecipeBillingSnapshot } = {};
    try {
      payload = await res.json();
    } catch {
      payload = {};
    }

    if (!res.ok) {
      throw new Error(typeof payload.message === 'string' ? payload.message : `Server error (${res.status}).`);
    }

    if (!payload.billing || typeof payload.billing.credits !== 'number') {
      throw new Error('Invalid billing response from server.');
    }

    await finishTransaction({ purchase, isConsumable: true });

    return payload.billing;
  } finally {
    await endConnection().catch(() => {});
  }
}
