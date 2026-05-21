'use strict';

/**
 * Verifies one-time Play in-app products via Android Publisher API v3.
 * Requires a service account JSON with “View financial data” / Play Android Developer API access
 * linked in Play Console → API access.
 */

async function verifyAndroidProductPurchase({ packageName, productId, purchaseToken }) {
  const keyPath = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON;
  const keyInline = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON_INLINE;
  if (!keyPath && !keyInline) {
    return { ok: false, reason: 'missing_credentials' };
  }

  const { google } = require('googleapis');
  const authOpts = { scopes: ['https://www.googleapis.com/auth/androidpublisher'] };
  if (keyPath) {
    authOpts.keyFile = keyPath;
  } else {
    authOpts.credentials = JSON.parse(keyInline);
  }
  const auth = new google.auth.GoogleAuth(authOpts);
  const androidpublisher = google.androidpublisher({ version: 'v3', auth });

  try {
    const { data } = await androidpublisher.purchases.products.get({
      packageName,
      productId,
      token: purchaseToken,
    });
    // 0 = Purchased (Payment pending / canceled use other values)
    if (data.purchaseState !== 0) {
      return { ok: false, reason: 'invalid_purchase_state', purchaseState: data.purchaseState };
    }
    return { ok: true, data };
  } catch (err) {
    const msg = err && typeof err.message === 'string' ? err.message : String(err);
    return { ok: false, reason: 'api_error', message: msg };
  }
}

/** Consumes a one-time product so the SKU can be purchased again (Play Billing). */
async function consumeAndroidProductPurchase({ packageName, productId, purchaseToken }) {
  const keyPath = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON;
  const keyInline = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON_INLINE;
  if (!keyPath && !keyInline) {
    return { ok: false, reason: 'missing_credentials' };
  }

  const { google } = require('googleapis');
  const authOpts = { scopes: ['https://www.googleapis.com/auth/androidpublisher'] };
  if (keyPath) {
    authOpts.keyFile = keyPath;
  } else {
    authOpts.credentials = JSON.parse(keyInline);
  }
  const auth = new google.auth.GoogleAuth(authOpts);
  const androidpublisher = google.androidpublisher({ version: 'v3', auth });

  try {
    await androidpublisher.purchases.products.consume({
      packageName,
      productId,
      token: purchaseToken,
    });
    return { ok: true };
  } catch (err) {
    const msg = err && typeof err.message === 'string' ? err.message : String(err);
    return { ok: false, reason: 'api_error', message: msg };
  }
}

module.exports = { verifyAndroidProductPurchase, consumeAndroidProductPurchase };
