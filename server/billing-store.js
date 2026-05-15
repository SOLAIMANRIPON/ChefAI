'use strict';

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const DATA_PATH = path.join(DATA_DIR, 'billing.json');
const IAP_LEDGER_PATH = path.join(DATA_DIR, 'iap-consumed.json');

const CREDIT_COST_TEXT_RECIPE = 1;
const CREDIT_COST_PHOTO_RECIPE = 3;

function readAll() {
  try {
    const raw = fs.readFileSync(DATA_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeAll(obj) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DATA_PATH, JSON.stringify(obj, null, 2), 'utf8');
}

function clampCredits(n) {
  const x = Number(n);
  if (!Number.isFinite(x) || x < 0) return 0;
  return Math.min(Math.floor(x), 1_000_000);
}

function getInitialCreditsForNewWallet() {
  const n = Number(process.env.CHEFAI_INITIAL_CREDITS ?? 15);
  return clampCredits(Number.isFinite(n) ? n : 15);
}

/** Wallet persisted per install id — credits only (legacy JSON fields are ignored on read). */
function normalizeWallet(raw) {
  const credits = clampCredits(raw?.credits ?? 0);
  return { credits };
}

function billingSnapshot(wallet) {
  const w = normalizeWallet(wallet);
  return {
    credits: w.credits,
    creditCostTextRecipe: CREDIT_COST_TEXT_RECIPE,
    creditCostPhotoRecipe: CREDIT_COST_PHOTO_RECIPE,
  };
}

function peekRecipeCharge(includeImage) {
  return includeImage
    ? { creditCost: CREDIT_COST_PHOTO_RECIPE }
    : { creditCost: CREDIT_COST_TEXT_RECIPE };
}

function canAffordRecipe(includeImage, wallet) {
  const w = normalizeWallet(wallet);
  const { creditCost } = peekRecipeCharge(includeImage);
  return w.credits >= creditCost;
}

function ensureWallet(installId) {
  const all = readAll();
  if (!all[installId]) {
    all[installId] = normalizeWallet({
      credits: getInitialCreditsForNewWallet(),
    });
    writeAll(all);
  }
  return normalizeWallet(all[installId]);
}

function applySuccessfulRecipeCharge(installId, includeImage) {
  ensureWallet(installId);
  const all = readAll();
  const prev = normalizeWallet(all[installId]);
  const { creditCost } = peekRecipeCharge(includeImage);
  const next = {
    credits: clampCredits(prev.credits - creditCost),
  };
  all[installId] = next;
  writeAll(all);
  return billingSnapshot(next);
}

function readIapLedger() {
  try {
    const raw = fs.readFileSync(IAP_LEDGER_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    const tokens = parsed?.tokens && typeof parsed.tokens === 'object' ? parsed.tokens : {};
    return { tokens };
  } catch {
    return { tokens: {} };
  }
}

function writeIapLedger(ledger) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(IAP_LEDGER_PATH, JSON.stringify({ tokens: ledger.tokens }, null, 2), 'utf8');
}

/**
 * Credits wallet after a verified Play consumable purchase.
 * Idempotent per purchaseToken (replay returns current billing for same installId).
 */
function grantCreditsForGooglePlayPurchase(installId, purchaseToken, creditsToAdd, meta) {
  const token = String(purchaseToken || '').trim();
  if (!token || token.length < 8) {
    return { ok: false, status: 400, message: 'Invalid purchaseToken.' };
  }
  const credits = clampCredits(creditsToAdd);
  if (credits <= 0) {
    return { ok: false, status: 400, message: 'Invalid credit amount for product.' };
  }

  ensureWallet(installId);
  const ledger = readIapLedger();
  const prevEntry = ledger.tokens[token];
  if (prevEntry) {
    if (prevEntry.installId !== installId) {
      return { ok: false, status: 403, message: 'Purchase token was already redeemed on another install.' };
    }
    const wallet = normalizeWallet(readAll()[installId]);
    return { ok: true, billing: billingSnapshot(wallet), duplicate: true };
  }

  const all = readAll();
  const prev = normalizeWallet(all[installId]);
  const next = { credits: clampCredits(prev.credits + credits) };
  all[installId] = next;
  writeAll(all);

  ledger.tokens[token] = {
    installId,
    credits,
    productId: meta?.productId || '',
    grantedAt: new Date().toISOString(),
  };
  writeIapLedger(ledger);

  return { ok: true, billing: billingSnapshot(next), duplicate: false };
}

module.exports = {
  billingSnapshot,
  peekRecipeCharge,
  canAffordRecipe,
  ensureWallet,
  applySuccessfulRecipeCharge,
  grantCreditsForGooglePlayPurchase,
};
