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
  getAvailablePurchases,
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

function purchaseProductId(purchase: Purchase): string {
  const id =
    (typeof purchase.productId === 'string' && purchase.productId.trim()) ||
    (typeof (purchase as { id?: string }).id === 'string' && (purchase as { id?: string }).id?.trim()) ||
    '';
  return id;
}

function isAlreadyOwnedPurchaseError(message: string): boolean {
  const m = message.toLowerCase();
  return m.includes('already own') || m.includes('item is already owned');
}

async function grantCreditsFromPurchase(
  purchase: Purchase,
  params: { apiBaseUrl: string; installId: string; packageName: string; productSku: string }
): Promise<RecipeBillingSnapshot> {
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
      productId: params.productSku,
      purchaseToken: token,
      packageName: params.packageName,
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
}

/** Finish purchases that succeeded on Play but were not consumed (e.g. server verify failed earlier). */
async function recoverUnfinishedCreditPurchases(params: {
  apiBaseUrl: string;
  installId: string;
  packageName: string;
}): Promise<RecipeBillingSnapshot | null> {
  const creditSkus = new Set(getCreditsProductSkus());
  let lastBilling: RecipeBillingSnapshot | null = null;

  const purchases = await getAvailablePurchases();
  for (const purchase of purchases ?? []) {
    const productSku = purchaseProductId(purchase);
    if (!creditSkus.has(productSku)) continue;
    try {
      lastBilling = await grantCreditsFromPurchase(purchase, { ...params, productSku });
    } catch {
      // Keep trying other pending SKUs (e.g. permission error on one token).
    }
  }

  return lastBilling;
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
    const recovered = await recoverUnfinishedCreditPurchases({
      apiBaseUrl: params.apiBaseUrl,
      installId: params.installId,
      packageName,
    });
    if (recovered) {
      return recovered;
    }

    const allSkus = getCreditsProductSkus();
    const skusToFetch = allSkus.includes(productSku) ? allSkus : [...allSkus, productSku];
    const items = await fetchProducts({ skus: skusToFetch, type: 'in-app' });
    const found = items?.some((p) => p.id === productSku || (p as { productId?: string }).productId === productSku);
    if (!items || items.length === 0 || !found) {
      throw new Error(
        `Play Store did not return product "${productSku}". Create all packs in Play Console and set EXPO_PUBLIC_PLAY_CREDITS_PRODUCT_IDS.`
      );
    }

    let purchase: Purchase;
    try {
      purchase = await new Promise<Purchase>((resolve, reject) => {
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
          if (purchaseProductId(p) !== productSku) return;
          cleanup(() => resolve(p));
        });

        const subErr = purchaseErrorListener((err) => {
          const cancelled =
            err.code === ErrorCode.UserCancelled ||
            String(err.code || '').toUpperCase().includes('USER_CANCELLED');
          const message = err.message || 'Purchase failed.';
          cleanup(() => {
            if (cancelled) {
              reject(new Error('Purchase cancelled.'));
              return;
            }
            reject(new Error(message));
          });
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
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      if (!isAlreadyOwnedPurchaseError(message)) {
        throw e instanceof Error ? e : new Error(message);
      }
      await new Promise((r) => setTimeout(r, 1000));
      const billing = await recoverUnfinishedCreditPurchases({
        apiBaseUrl: params.apiBaseUrl,
        installId: params.installId,
        packageName,
      });
      if (billing) return billing;
      throw new Error(
        'Google Play still shows an unfinished purchase for this pack. Refund the test order in Play Console → Order management, or try a different pack (Large).'
      );
    }

    return grantCreditsFromPurchase(purchase, {
      apiBaseUrl: params.apiBaseUrl,
      installId: params.installId,
      packageName,
      productSku,
    });
  } finally {
    await endConnection().catch(() => {});
  }
}
