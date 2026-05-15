const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { TtlCache, canonicalKey } = require('./cache');
const {
  billingSnapshot,
  peekRecipeCharge,
  canAffordRecipe,
  ensureWallet,
  applySuccessfulRecipeCharge,
  grantCreditsForGooglePlayPurchase,
} = require('./billing-store');
const { verifyAndroidProductPurchase } = require('./google-play-verify');

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 3000);
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_TEXT_MODEL = (process.env.GEMINI_TEXT_MODEL || 'gemini-3-flash-preview').trim();
const GEMINI_IMAGE_MODEL = 'gemini-2.5-flash-image';
const BILLING_ENABLED = process.env.CHEFAI_BILLING_DISABLED !== '1';
const ANDROID_PACKAGE_DEFAULT = 'com.solaiman.chefai';
const PLAY_VERIFY_DISABLED = process.env.CHEFAI_PLAY_VERIFY_DISABLED === '1';

function parsePlayProductCreditsMap() {
  const raw = process.env.CHEFAI_PLAY_PRODUCT_CREDITS_JSON;
  if (raw && String(raw).trim()) {
    try {
      const obj = JSON.parse(raw);
      if (obj && typeof obj === 'object') {
        const out = {};
        for (const [k, v] of Object.entries(obj)) {
          const id = typeof k === 'string' ? k.trim() : '';
          const n = typeof v === 'number' ? v : Number(v);
          if (id && Number.isFinite(n) && n > 0) {
            out[id] = Math.min(Math.floor(n), 1_000_000);
          }
        }
        if (Object.keys(out).length) return out;
      }
    } catch {
      /* fall through */
    }
  }
  const singleId = String(process.env.CHEFAI_PLAY_CREDITS_PRODUCT_ID || '').trim();
  const amount = Number(process.env.CHEFAI_PLAY_CREDITS_AMOUNT ?? 0);
  if (singleId && Number.isFinite(amount) && amount > 0) {
    return { [singleId]: Math.min(Math.floor(amount), 1_000_000) };
  }
  return {
    chefai_credits_small: 30,
    chefai_credits_pack: 80,
    chefai_credits_large: 200,
  };
}

function playVerificationConfigured() {
  return Boolean(
    process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON || process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON_INLINE
  );
}

/** Validates ChefAI mobile install ids (`constants/chefai-billing.ts`). */
function parseChefAiInstallId(req) {
  const raw = req.headers['x-chefai-install-id'] || req.headers['X-ChefAI-Install-Id'];
  const trimmed = String(raw || '').trim().toLowerCase();
  if (!/^[\da-f]{32}$/.test(trimmed)) return null;
  return trimmed;
}

// Per-endpoint AI response caches. TTLs picked so popular repeat queries
// (same ingredient/dish/cuisine combo) skip Gemini entirely while still
// expiring fast enough that prompt-engineering changes ship cleanly.
const recipeListCache = new TtlCache();
const recipeDetailsCache = new TtlCache();
const shoppingListCache = new TtlCache();
const TTL_RECIPE_LIST = 6 * 60 * 60 * 1000; // 6 hours
const TTL_RECIPE_DETAILS = 24 * 60 * 60 * 1000; // 24 hours
const TTL_SHOPPING_LIST = 24 * 60 * 60 * 1000; // 24 hours

app.use(cors());
app.use(express.json({ limit: '6mb' }));

const normalizeGenerationMode = (mode) => (mode === 'creative' ? 'creative' : 'strict');

const normalizeDietPreference = (value) =>
  value === 'vegetarian' || value === 'vegan' || value === 'gluten_free' ? value : 'none';

const normalizeSpiceLevel = (value) =>
  value === 'mild' || value === 'medium' || value === 'hot' ? value : 'medium';

const normalizeDifficultyLevel = (value) =>
  value === 'easy' || value === 'medium' || value === 'hard' ? value : 'medium';

const coerceCalories = (raw) => {
  if (raw === undefined || raw === null || raw === '') return null;
  const n = typeof raw === 'number' ? raw : Number.parseInt(String(raw).replace(/\D/g, ''), 10);
  if (!Number.isFinite(n) || n < 1 || n > 8000) return null;
  return n;
};

const coerceServings = (raw) => {
  const fallback = 4;
  if (raw === undefined || raw === null || raw === '') return fallback;
  const n = typeof raw === 'number' ? raw : Number.parseInt(String(raw).replace(/\D/g, ''), 10);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(n, 20);
};

const coerceCookTimeMinutes = (raw) => {
  if (raw === undefined || raw === null || raw === '') return null;
  const n = typeof raw === 'number' ? raw : Number.parseInt(String(raw).replace(/\D/g, ''), 10);
  if (!Number.isFinite(n) || n < 1 || n > 600) return null;
  return n;
};

/** Builds English constraint lines for Gemini (recipe names + full recipes). */
function buildNutritionConstraints({ dietPreference, spiceLevel, maxCaloriesPerMeal }) {
  const diet = normalizeDietPreference(dietPreference);
  const spice = normalizeSpiceLevel(spiceLevel);
  const cal = coerceCalories(maxCaloriesPerMeal);
  const parts = [];

  if (diet === 'vegan') {
    parts.push(
      'Diet is strictly VEGAN: no meat, fish, seafood, eggs, dairy, or honey; use only plant-based ingredients and substitutions.'
    );
  } else if (diet === 'vegetarian') {
    parts.push('Diet is VEGETARIAN: no meat, fish, or seafood; eggs and dairy are allowed unless otherwise incompatible.');
  } else if (diet === 'gluten_free') {
    parts.push(
      'Diet is GLUTEN-FREE: no wheat, barley, rye, or malt; suggest GF substitutes (e.g., rice, labeled GF flour/soy sauce).'
    );
  }

  if (spice === 'mild') {
    parts.push('Spice/heat: MILD — very little chili heat; aromatic spices OK without strong burn.');
  } else if (spice === 'hot') {
    parts.push('Spice/heat: HOT — noticeably spicy; use chilies generously where fitting.');
  } else {
    parts.push('Spice/heat: MEDIUM — balanced chili heat.');
  }

  if (cal != null) {
    parts.push(
      `Calorie target: aim for roughly ${cal} kcal or less per meal/serving where reasonable; mention approximate calories if possible.`
    );
  }

  return parts.join(' ');
}

const parseRecipeList = (text) =>
  text
    .split('\n')
    .map((line) => line.replace(/^\s*\d+[\).\-\s]*/, '').trim())
    .filter(Boolean)
    .slice(0, 10);

const parseStringArrayJson = (text) => {
  if (!text || typeof text !== 'string') return [];
  const trimmed = text.trim();
  const tryParse = (chunk) => {
    try {
      const v = JSON.parse(chunk);
      if (Array.isArray(v) && v.every((x) => typeof x === 'string')) {
        return v.map((s) => s.trim()).filter(Boolean);
      }
    } catch {
      return null;
    }
    return null;
  };
  const direct = tryParse(trimmed);
  if (direct) return direct.slice(0, 60);
  const block = trimmed.match(/\[[\s\S]*\]/);
  if (block) {
    const fromBlock = tryParse(block[0]);
    if (fromBlock) return fromBlock.slice(0, 60);
  }
  return [];
};

/** Very small fallback if Gemini is off: pick short lines that look like ingredients. */
const fallbackShoppingItemsFromRecipe = (recipeText) => {
  const lines = String(recipeText || '')
    .split('\n')
    .map((l) => l.replace(/\*\*/g, '').trim())
    .filter(Boolean);
  const out = [];
  let inBlock = false;
  for (const line of lines) {
    const low = line.toLowerCase();
    if (/^ingredients\b|^উপকরণ\b|^you will need\b/i.test(line)) {
      inBlock = true;
      continue;
    }
    if (inBlock && /^(step|ধাপ|method|preparation)\b/i.test(line)) break;
    if (inBlock && (line.startsWith('•') || line.startsWith('-') || line.startsWith('*'))) {
      out.push(line.replace(/^[•\-\*]\s*/, '').trim());
    }
  }
  if (out.length) return out.slice(0, 40);
  for (const line of lines) {
    if (line.length > 5 && line.length < 100 && /\d/.test(line) && /(g|kg|ml|cup|tbsp|tsp|চামচ|গ্রাম|টা|কাপ)/i.test(line)) {
      out.push(line.replace(/^\d+[\).\s]+/, '').trim());
    }
  }
  return [...new Set(out)].slice(0, 25);
};

const buildDishImageUrl = (seedText) => {
  const label = encodeURIComponent(String(seedText || 'ChefAI Food').slice(0, 40));
  return `https://placehold.co/1024x768/111111/d3b275?text=${label}`;
};

/**
 * Mirror of `lib/recipe-structured.ts` — kept inline because the server is
 * plain JS and can't import the TS module without a build step. Update both
 * sides together when changing the structured-recipe contract.
 */
const RECIPE_SECTION_LABELS_BY_LANGUAGE = {
  বাংলা: { ingredients: 'উপকরণ', instructions: 'নির্দেশনা', tips: 'টিপস', yieldsLabel: 'পরিবেশন', servingsLabel: 'জন' },
  English: { ingredients: 'Ingredients', instructions: 'Instructions', tips: 'Tips', yieldsLabel: 'Yields', servingsLabel: 'servings' },
  Hindi: { ingredients: 'सामग्री', instructions: 'निर्देश', tips: 'सुझाव', yieldsLabel: 'परिमाण', servingsLabel: 'सर्विंग्स' },
  Arabic: { ingredients: 'المكونات', instructions: 'التعليمات', tips: 'نصائح', yieldsLabel: 'الكمية', servingsLabel: 'حصص' },
  Urdu: { ingredients: 'اجزاء', instructions: 'ہدایات', tips: 'تجاویز', yieldsLabel: 'مقدار', servingsLabel: 'حصص' },
  Spanish: { ingredients: 'Ingredientes', instructions: 'Instrucciones', tips: 'Consejos', yieldsLabel: 'Rinde', servingsLabel: 'porciones' },
  French: { ingredients: 'Ingrédients', instructions: 'Instructions', tips: 'Astuces', yieldsLabel: 'Portions', servingsLabel: 'portions' },
};

function coerceStringArray(value, max = 80) {
  if (!Array.isArray(value)) return [];
  const out = [];
  for (const v of value) {
    if (typeof v === 'string') {
      const t = v.trim();
      if (t) out.push(t);
    } else if (v && typeof v === 'object') {
      const candidate = v.text || v.name || v.value || '';
      const t = String(candidate).trim();
      if (t) out.push(t);
    }
    if (out.length >= max) break;
  }
  return out;
}

function readStructuredRecipeFromPayload(payload) {
  if (!payload || typeof payload !== 'object') {
    return { ingredients: [], steps: [], tips: [], yieldServings: null };
  }
  let yieldServings = null;
  const yr = payload.yieldServings;
  if (typeof yr === 'number' && Number.isFinite(yr)) yieldServings = Math.round(yr);
  else if (typeof yr === 'string' && yr.trim()) {
    const n = Number.parseInt(yr.trim(), 10);
    if (Number.isFinite(n)) yieldServings = n;
  }
  return {
    ingredients: coerceStringArray(payload.ingredients),
    steps: coerceStringArray(payload.steps),
    tips: coerceStringArray(payload.tips),
    yieldServings,
  };
}

/** Last-resort step extraction for legacy text returned without arrays. */
function deriveStepsFromText(text) {
  const trimmed = (text || '').trim();
  if (!trimmed) return [];
  const re = /(?:^|\s)(\d+)[.)।]\s+/g;
  const starts = [];
  let m;
  while ((m = re.exec(trimmed)) !== null) {
    const offset = m[0].search(/\d/);
    starts.push(m.index + offset);
  }
  if (starts.length >= 2) {
    const out = [];
    for (let i = 0; i < starts.length; i += 1) {
      const a = starts[i];
      const b = i + 1 < starts.length ? starts[i + 1] : trimmed.length;
      const seg = trimmed.slice(a, b).trim().replace(/^\d+[.)।]\s+/, '').trim();
      if (seg) out.push(seg);
    }
    return out;
  }
  return trimmed.split(/\n/).map((l) => l.trim()).filter(Boolean);
}

function deriveStructuredFromText(text) {
  return {
    ingredients: [],
    steps: deriveStepsFromText(text),
    tips: [],
    yieldServings: null,
  };
}

function joinStructuredRecipe(structured, language) {
  const labels = RECIPE_SECTION_LABELS_BY_LANGUAGE[language] || RECIPE_SECTION_LABELS_BY_LANGUAGE.English;
  const parts = [];
  if (structured.yieldServings != null && Number.isFinite(structured.yieldServings)) {
    parts.push(`${labels.yieldsLabel}: ${structured.yieldServings} ${labels.servingsLabel}.`);
  }
  if (Array.isArray(structured.ingredients) && structured.ingredients.length) {
    parts.push(`${labels.ingredients}:`);
    for (const item of structured.ingredients) {
      const t = String(item || '').trim();
      if (t) parts.push(`• ${t}`);
    }
  }
  if (Array.isArray(structured.steps) && structured.steps.length) {
    if (parts.length) parts.push('');
    parts.push(`${labels.instructions}:`);
    structured.steps.forEach((step, i) => {
      const t = String(step || '').trim();
      if (t) parts.push(`${i + 1}. ${t}`);
    });
  }
  if (Array.isArray(structured.tips) && structured.tips.length) {
    if (parts.length) parts.push('');
    parts.push(`${labels.tips}:`);
    for (const tip of structured.tips) {
      const t = String(tip || '').trim();
      if (t) parts.push(`• ${t}`);
    }
  }
  return parts.join('\n');
}

async function generateText(prompt, timeoutMs = 60000) {
  if (!GEMINI_API_KEY) {
    console.warn('[generateText] GEMINI_API_KEY missing — returning null (server fallback will be used).');
    return null;
  }
  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: GEMINI_TEXT_MODEL });
  // 2 attempts keeps total worst-case wait ≤ ~135s for 60s base timeout, which
  // is acceptable for the user. More retries rarely help — if the model is
  // overloaded enough to time out at 60s, the cost of more retries outweighs
  // the marginal benefit.
  const maxAttempts = 2;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    // Give each retry a slightly larger budget; complex JSON prompts can take
    // 30–60s on flash-lite preview models, so the first attempt alone needs
    // ~60s, and retries get up to ~75s/90s.
    const attemptTimeoutMs = Math.round(timeoutMs * (1 + (attempt - 1) * 0.25));
    try {
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Gemini timeout')), attemptTimeoutMs);
      });

      const resultPromise = model.generateContent(prompt);
      const result = await Promise.race([resultPromise, timeoutPromise]);
      const text = result.response.text();
      if (!text) {
        console.warn(`[generateText] Empty response from ${GEMINI_TEXT_MODEL} (attempt ${attempt}/${maxAttempts}).`);
        if (attempt < maxAttempts) continue;
        return null;
      }
      return text;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const status = error?.status || error?.statusCode;
      const isTemporaryOverload =
        message.includes('503') ||
        message.toLowerCase().includes('service unavailable') ||
        message.toLowerCase().includes('high demand');
      const isTimeout =
        message.toLowerCase().includes('timeout') ||
        message.toLowerCase().includes('timed out');
      const isQuotaOrBillingIssue =
        message.includes('429') ||
        message.toLowerCase().includes('quota') ||
        message.toLowerCase().includes('billing') ||
        message.toLowerCase().includes('prepayment credits are depleted');
      const isModelNotFound =
        message.includes('404') ||
        message.toLowerCase().includes('not found') ||
        message.toLowerCase().includes('was not found') ||
        message.toLowerCase().includes('does not exist');
      const isAuthError =
        message.includes('401') ||
        message.includes('403') ||
        message.toLowerCase().includes('api key') ||
        message.toLowerCase().includes('permission denied') ||
        message.toLowerCase().includes('unauthorized');
      const isTransient = isTemporaryOverload || isTimeout;

      console.error(
        `[generateText] attempt ${attempt}/${maxAttempts} failed (model=${GEMINI_TEXT_MODEL}, attemptTimeout=${attemptTimeoutMs}ms${
          status ? `, status=${status}` : ''
        }): ${message}`
      );

      // Hard-fail (no retry) on configuration / billing errors — retries won't help.
      if (isModelNotFound) {
        console.error(
          `[generateText] Model "${GEMINI_TEXT_MODEL}" not found. Check GEMINI_TEXT_MODEL in .env (e.g. gemini-2.5-flash, gemini-3.1-flash-lite).`
        );
        return null;
      }
      if (isAuthError) {
        console.error('[generateText] Auth error — verify GEMINI_API_KEY is valid and has access to this model.');
        return null;
      }
      if (isQuotaOrBillingIssue) {
        console.error('[generateText] Quota or billing issue — using fallback.');
        return null;
      }

      // Retry transient failures (overload + timeout) with backoff.
      if (isTransient && attempt < maxAttempts) {
        const backoffMs = attempt * 1200;
        console.warn(`[generateText] Transient failure — retrying after ${backoffMs}ms (attempt ${attempt + 1}/${maxAttempts}).`);
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
        continue;
      }

      if (isTransient) {
        console.warn('[generateText] Transient failures exhausted retries — using fallback.');
        return null;
      }
      throw error;
    }
  }

  return null;
}

async function generateTextFromImage({ prompt, base64Data, mimeType = 'image/jpeg' }, timeoutMs = 30000) {
  if (!GEMINI_API_KEY) return null;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    GEMINI_TEXT_MODEL
  )}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`;

  const timeout = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Gemini image-text timeout')), timeoutMs);
  });

  const request = fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType,
                data: base64Data,
              },
            },
          ],
        },
      ],
    }),
  }).then(async (response) => {
    if (!response.ok) throw new Error(`Gemini image-text failed (${response.status})`);
    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.find((part) => typeof part?.text === 'string')?.text;
    return typeof text === 'string' && text.trim() ? text : null;
  });

  return Promise.race([request, timeout]);
}

const IMAGE_PROMPT_GLOBAL_SUFFIX =
  'ultra realistic food photography, natural soft light, close-up plated dish in a bowl or plate, no text, no watermark, no logos. Species and ingredient fidelity: depict exactly what the dish text describes; when a specific fish or vegetable is named, match that type — do not substitute a different species or a generic look-alike; for small river fish curries show small whole fish or typical small-fish cuts, not thick circular steaks from large carps unless the dish is explicitly large carp (rohu, katla).';

async function generateImageFromGemini(imagePrompt, timeoutMs = 22000) {
  if (!GEMINI_API_KEY) return null;
  const finalPrompt = `${imagePrompt}, ${IMAGE_PROMPT_GLOBAL_SUFFIX}`;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    GEMINI_IMAGE_MODEL
  )}:generateContent?key=${encodeURIComponent(
    GEMINI_API_KEY
  )}`;

  const timeout = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Gemini image timeout')), timeoutMs);
  });

  const request = fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: finalPrompt }] }],
    }),
  }).then(async (response) => {
    if (!response.ok) throw new Error(`Gemini image failed (${response.status})`);
    const data = await response.json();
    const imagePart = data?.candidates?.[0]?.content?.parts?.find((part) => part?.inlineData?.data);
    const base64 = imagePart?.inlineData?.data;
    const mimeType = imagePart?.inlineData?.mimeType || 'image/png';
    if (!base64) return null;
    return `data:${mimeType};base64,${base64}`;
  });

  return Promise.race([request, timeout]);
}

async function generateImageFromGeminiWithRetry(imagePrompt) {
  const timeoutMs = 22000;
  const maxAttempts = 2;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const imageUrl = await generateImageFromGemini(imagePrompt, timeoutMs);
      if (imageUrl) return imageUrl;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const isRetryable =
        message.includes('429') ||
        message.includes('500') ||
        message.includes('503') ||
        message.toLowerCase().includes('timeout') ||
        message.toLowerCase().includes('service unavailable') ||
        message.toLowerCase().includes('high demand');
      if (!isRetryable || attempt === maxAttempts) break;
      await new Promise((resolve) => setTimeout(resolve, attempt * 1500));
    }
  }
  return null;
}

const buildDishSpecificImagePrompt = ({ dishName, cuisine, queryText, basePrompt }) => {
  const combined = `${dishName} ${queryText}`.toLowerCase();
  const base = String(basePrompt || `${dishName} ${cuisine} food`).trim();

  if (combined.includes('লাল শাক') || combined.includes('lal shak') || combined.includes('red amaranth')) {
    return `${base}, Bangladeshi red amaranth stir fry (lal shak bhaji), deep red and purple amaranth leaves and stems, authentic home-cooked plating, avoid green spinach look`;
  }

  // Pabda = small butter catfish — models often default to large carp steaks; spell morphology + negatives.
  if (
    combined.includes('পাবদা') ||
    combined.includes('pabda') ||
    combined.includes('pabdha') ||
    combined.includes('ompok')
  ) {
    const isMustard =
      combined.includes('সরষে') ||
      combined.includes('sorshe') ||
      combined.includes('sorse') ||
      combined.includes('mustard');
    const gravyHint = isMustard
      ? 'golden-yellow mustard-based gravy (shorshe), nigella seeds, green chilies visible'
      : 'light Bengali jhol-style gravy, turmeric, green chili, mustard oil sheen';
    return `${base}, Bangladeshi home-style pabda fish curry: ONLY small freshwater butter catfish (pabda / Ompok bimaculatus type)—two to four small whole fish or small curved bodies in the bowl, silvery-pink cooked skin, delicate size typical of pabda; absolutely avoid thick round cross-section bone-in steaks from large carps; avoid rohu, katla, salmon-style steaks, or oversized fish chunks; ${gravyHint}; rustic ceramic or steel bowl; top-down or 45 degree food photo; cooked fish texture; no humans; no animals except the cooked fish in the dish`;
  }

  if (
    combined.includes('ইলিশ') ||
    combined.includes('ilish') ||
    combined.includes('hilsa') ||
    combined.includes('ilish maach')
  ) {
    return `${base}, Bangladeshi hilsa (ilish) preparation: long silver-blue hilsa pieces with distinctive oily sheen and typical ilish shape—not carp steaks; mustard or light gravy as fits the dish; authentic Bengali plating`;
  }

  return `${base}, authentic ${cuisine} dish, faithful to named main ingredients, accurate colors and realistic textures`;
};

app.get('/', (_req, res) => {
  res.type('text/plain').send('ChefAI backend is running. Check GET /api/v1/health for status.');
});

/** Public privacy policy for Google Play (also mirrored on GitHub Pages). */
const privacyHtmlPath = path.join(__dirname, '..', 'docs', 'privacy.html');
app.get('/privacy', (_req, res) => {
  res.sendFile(privacyHtmlPath);
});
app.get('/privacy.html', (_req, res) => {
  res.sendFile(privacyHtmlPath);
});

app.get('/api/v1/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'ChefAI backend',
    geminiConfigured: Boolean(GEMINI_API_KEY),
    textModel: GEMINI_TEXT_MODEL,
    imageModel: GEMINI_IMAGE_MODEL,
    billingEnabled: BILLING_ENABLED,
    playPurchaseVerificationConfigured: playVerificationConfigured(),
    playPurchaseVerificationDisabled: PLAY_VERIFY_DISABLED,
    timestamp: new Date().toISOString(),
    cache: {
      recipeList: recipeListCache.stats(),
      recipeDetails: recipeDetailsCache.stats(),
      shoppingList: shoppingListCache.stats(),
    },
  });
});

app.get('/api/v1/billing/state', (req, res) => {
  if (!BILLING_ENABLED) {
    return res.json({
      credits: 999999,
      creditCostTextRecipe: 1,
      creditCostPhotoRecipe: 3,
      billingDisabled: true,
    });
  }
  const installId = parseChefAiInstallId(req);
  if (!installId) {
    return res.status(400).json({
      message: 'Missing or invalid X-ChefAI-Install-Id header (expected 32 hex characters).',
    });
  }
  const wallet = ensureWallet(installId);
  res.json({ ...billingSnapshot(wallet), billingDisabled: false });
});

/**
 * Confirms a Google Play consumable purchase and credits the install wallet.
 * Body: { productId, purchaseToken, packageName? }
 */
app.post('/api/v1/billing/google-play/grant-credits', async (req, res) => {
  if (!BILLING_ENABLED) {
    return res.status(400).json({ message: 'Billing is disabled on this server.' });
  }
  const installId = parseChefAiInstallId(req);
  if (!installId) {
    return res.status(400).json({
      message: 'Missing or invalid X-ChefAI-Install-Id header (expected 32 hex characters).',
    });
  }

  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const productId = typeof body.productId === 'string' ? body.productId.trim() : '';
  const purchaseToken = typeof body.purchaseToken === 'string' ? body.purchaseToken.trim() : '';
  const packageName =
    typeof body.packageName === 'string' && body.packageName.trim()
      ? body.packageName.trim()
      : String(process.env.CHEFAI_ANDROID_PACKAGE_NAME || ANDROID_PACKAGE_DEFAULT).trim();

  if (!productId || !purchaseToken) {
    return res.status(400).json({ message: 'productId and purchaseToken are required.' });
  }

  const productMap = parsePlayProductCreditsMap();
  const creditsForProduct = productMap[productId];
  if (!creditsForProduct) {
    return res.status(400).json({
      message: `Unknown productId "${productId}". Configure CHEFAI_PLAY_PRODUCT_CREDITS_JSON or CHEFAI_PLAY_CREDITS_PRODUCT_ID.`,
    });
  }

  if (!PLAY_VERIFY_DISABLED) {
    if (!playVerificationConfigured()) {
      return res.status(503).json({
        message:
          'Play purchase verification is not configured (set GOOGLE_PLAY_SERVICE_ACCOUNT_JSON or GOOGLE_PLAY_SERVICE_ACCOUNT_JSON_INLINE). For local experiments only, CHEFAI_PLAY_VERIFY_DISABLED=1 (never on a public server).',
      });
    }
    const ver = await verifyAndroidProductPurchase({
      packageName,
      productId,
      purchaseToken,
    });
    if (!ver.ok) {
      const detail =
        ver.reason === 'missing_credentials'
          ? 'Server credentials missing.'
          : ver.reason === 'invalid_purchase_state'
            ? `Invalid purchase state (${ver.purchaseState}).`
            : ver.reason === 'api_error'
              ? ver.message || 'Google Play API error.'
              : 'Verification failed.';
      return res.status(403).json({ message: detail });
    }
  } else {
    console.warn('[billing] CHEFAI_PLAY_VERIFY_DISABLED=1 — granting credits without Play API verification');
  }

  const grant = grantCreditsForGooglePlayPurchase(installId, purchaseToken, creditsForProduct, {
    productId,
  });
  if (!grant.ok) {
    return res.status(grant.status).json({ message: grant.message });
  }
  res.json({ billing: grant.billing, duplicate: grant.duplicate === true });
});

/** Community feed — same shape as app `CommunityPost`; extend or replace with DB later */
const COMMUNITY_FEED_STATIC = [
  {
    id: 'seed-mishti-doi',
    authorName: 'Rumana',
    dishTitle: 'Mishti doi (sweet yogurt)',
    caption: 'Afternoon treat — set yogurt made at home.',
    imageUrl: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=900&q=80',
    recipePreview: 'Heat milk, cool, culture overnight 6–8 hours with a little starter and sugar to taste.',
    baseLikes: 42,
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
  },
  {
    id: 'seed-kacchi',
    authorName: 'Chef Omar',
    dishTitle: 'Kacchi biryani',
    caption: 'Weekend special — layered rice and mutton.',
    imageUrl: 'https://images.unsplash.com/photo-1563379091339-03246963d29c?w=900&q=80',
    recipePreview: 'Marinated meat, fried potato, rice layers — seal and cook on low (“dum”) until tender.',
    baseLikes: 128,
    createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
  },
  {
    id: 'seed-shorshe-ilish',
    authorName: 'Tanvir',
    dishTitle: 'Hilsa in mustard (shorshe ilish)',
    caption: 'Seasonal hilsa with mustard paste and green chili.',
    imageUrl: 'https://images.unsplash.com/photo-1580959378444-185327b9e82c?w=900&q=80',
    recipePreview: 'Marinate fish in mustard–nigella paste; finish with mustard oil and a gentle simmer.',
    baseLikes: 89,
    createdAt: new Date(Date.now() - 86400000 * 8).toISOString(),
  },
  {
    id: 'seed-fuchka',
    authorName: 'Neelu',
    dishTitle: 'Pani puri / fuchka',
    caption: 'Street-style crunch — tangy spiced water at home.',
    imageUrl: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=900&q=80',
    recipePreview: 'Crisp shells, potato–chickpea filling, and chilled tangy jaljeera-style water.',
    baseLikes: 56,
    createdAt: new Date(Date.now() - 86400000 * 12).toISOString(),
  },
];

app.get('/api/v1/community/feed', (_req, res) => {
  res.json({ posts: COMMUNITY_FEED_STATIC });
});

app.post('/api/v1/ai/recipes/list', async (req, res) => {
  try {
    const {
      query,
      ingredient,
      cuisine = 'Bangladeshi',
      language = 'English',
      generationMode: rawMode,
      dietPreference,
      spiceLevel,
      maxCaloriesPerMeal,
      servings: rawServings,
      difficultyLevel: rawDifficultyLevel,
      cookTimeMinutes: rawCookTimeMinutes,
    } = req.body || {};
    const generationMode = normalizeGenerationMode(rawMode);
    const userQuery = String(query || ingredient || '').trim();
    const servings = coerceServings(rawServings);
    const difficultyLevel = normalizeDifficultyLevel(rawDifficultyLevel);
    const cookTimeMinutes = coerceCookTimeMinutes(rawCookTimeMinutes);

    if (!userQuery) {
      return res.status(400).json({ message: 'query or ingredient is required' });
    }

    // Skip the cache when the client explicitly asks for a fresh batch (e.g.
    // user tapped "more options"). Cache hit = zero Gemini cost.
    const noCache = req.body?.nocache === true || req.query?.nocache === '1';
    const cacheKey = canonicalKey('recipes/list', {
      userQuery,
      cuisine,
      language,
      generationMode,
      dietPreference,
      spiceLevel,
      maxCaloriesPerMeal,
      servings,
      difficultyLevel,
      cookTimeMinutes,
    });
    if (!noCache) {
      const cached = recipeListCache.get(cacheKey);
      if (cached) {
        return res.json({ ...cached, cached: true });
      }
    }

    // Compact prompt: collapsed verbose constraint blocks into hint phrases.
    const styleHint =
      generationMode === 'creative'
        ? 'creative/fusion-leaning names OK'
        : `familiar reliable ${cuisine} names; classic combos`;
    const difficultyHint =
      difficultyLevel === 'easy'
        ? 'easy'
        : difficultyLevel === 'hard'
          ? 'advanced OK'
          : 'medium home-cooking';
    const timeHint = cookTimeMinutes != null ? `, ~${cookTimeMinutes} min` : '';

    const nutritionBlock = buildNutritionConstraints({ dietPreference, spiceLevel, maxCaloriesPerMeal });

    const prompt = `Give 10 ${cuisine} recipe names for input "${userQuery}" (ingredient or dish).
Servings ${servings}, ${difficultyHint}${timeHint}. Style: ${styleHint}.
${nutritionBlock ? `Constraints (must honor): ${nutritionBlock}` : ''}
Return ONLY the list in ${language}, one name per line, no numbering.`;

    const text = await generateText(prompt, 35000);
    if (!text) {
      console.warn(
        `[recipes] Falling back to placeholder names for "${userQuery}" — see [generateText] log lines for the root cause.`
      );
      const fallbackRecipes = [
        `${userQuery} Special`,
        `${userQuery} Classic`,
        `${userQuery} Curry`,
        `${userQuery} Fry`,
        `${userQuery} Soup`,
        `${userQuery} Masala`,
        `${userQuery} Roast`,
        `${userQuery} Kebab`,
        `${userQuery} Rice Bowl`,
        `${userQuery} Fusion`,
      ];
      // Don't cache degraded responses — we want the next request to retry.
      return res.json({ recipes: fallbackRecipes, degraded: true });
    }

    const recipes = parseRecipeList(text);
    if (!recipes.length) return res.status(502).json({ message: 'No recipes generated' });
    const payload = { recipes };
    recipeListCache.set(cacheKey, payload, TTL_RECIPE_LIST);
    return res.json(payload);
  } catch (error) {
    console.error('recipes/list failed:', error);
    return res.status(500).json({
      message: error instanceof Error ? error.message : 'Failed to generate recipe list',
    });
  }
});

app.post('/api/v1/ai/recipes/details', async (req, res) => {
  try {
    const {
      recipeName = 'Recipe',
      query = '',
      ingredient = '',
      cuisine = 'Bangladeshi',
      language = 'English',
      generationMode: rawMode,
      dietPreference,
      spiceLevel,
      maxCaloriesPerMeal,
      servings: rawServings,
      difficultyLevel: rawDifficultyLevel,
      cookTimeMinutes: rawCookTimeMinutes,
      includeImage: rawIncludeImage,
    } = req.body || {};

    const includeImage =
      rawIncludeImage === undefined || rawIncludeImage === null ? true : Boolean(rawIncludeImage);

    let installId = null;
    if (BILLING_ENABLED) {
      installId = parseChefAiInstallId(req);
      if (!installId) {
        return res.status(400).json({
          message: 'Missing or invalid X-ChefAI-Install-Id header (expected 32 hex characters).',
        });
      }
    }

    const generationMode = normalizeGenerationMode(rawMode);
    const userQuery = String(query || ingredient || '').trim();
    const servings = coerceServings(rawServings);
    const difficultyLevel = normalizeDifficultyLevel(rawDifficultyLevel);
    const cookTimeMinutes = coerceCookTimeMinutes(rawCookTimeMinutes);

    const noCache = req.body?.nocache === true || req.query?.nocache === '1';
    const cachePayload = {
      recipeName,
      userQuery,
      cuisine,
      language,
      generationMode,
      dietPreference,
      spiceLevel,
      maxCaloriesPerMeal,
      servings,
      difficultyLevel,
      cookTimeMinutes,
      includeImage,
      ...(BILLING_ENABLED ? { installId } : {}),
    };
    const cacheKey = canonicalKey('recipes/details', cachePayload);
    if (!noCache) {
      const cached = recipeDetailsCache.get(cacheKey);
      if (cached) {
        const billingPayload =
          BILLING_ENABLED && installId ? billingSnapshot(ensureWallet(installId)) : undefined;
        return res.json({
          ...cached,
          cached: true,
          ...(billingPayload ? { billing: billingPayload } : {}),
        });
      }
    }

    if (BILLING_ENABLED && installId) {
      const wallet = ensureWallet(installId);
      const snapshotBefore = billingSnapshot(wallet);
      if (!canAffordRecipe(includeImage, wallet)) {
        const { creditCost } = peekRecipeCharge(includeImage, wallet);
        return res.status(403).json({
          code: 'INSUFFICIENT_CREDITS',
          message: `You need ${creditCost} credit(s) for this option.`,
          creditCost,
          includeImage,
          ...snapshotBefore,
        });
      }
    }

    // Compact prompt: every line earns its keep. Removed verbose JSON schema
    // annotations (model knows the shape from the keys + brief hints) and
    // dropped the duplicated user-input echo since recipeName already covers
    // it.
    const styleHint =
      generationMode === 'creative'
        ? 'creative variations OK'
        : 'strict, conservative, precise quantities';
    const difficultyHint =
      difficultyLevel === 'easy'
        ? 'easy/beginner-friendly'
        : difficultyLevel === 'hard'
          ? 'advanced techniques OK'
          : 'medium home-cooking';
    const timeHint = cookTimeMinutes != null ? `, ~${cookTimeMinutes} min total` : '';

    const nutritionBlock = buildNutritionConstraints({ dietPreference, spiceLevel, maxCaloriesPerMeal });

    const prompt = `Create a ${cuisine} recipe "${recipeName}" in ${language}.
Servings: ${servings}. Style: ${styleHint}; ${difficultyHint}${timeHint}.
${nutritionBlock ? `Constraints: ${nutritionBlock}` : ''}

Return STRICT JSON only (no markdown/commentary):
{
  "dishName": "in ${language}",
  "yieldServings": <int or null>,
  "ingredients": ["amount + unit + name per item"],
  "steps": ["one self-contained instruction per item, no numbering, no section headers"],
  "tips": ["optional short tip; empty array if none"],
  "imagePrompt": "short english food photo query with dish + cuisine",
  "nutritionEstimate": { "caloriesKcal": <num or null>, "proteinG": <num or null>, "carbsG": <num or null> }
}

Rules:
- Arrays only — never one paragraph. 4–12 steps. No "1.", "Step 1:", or "Ingredients:" inside elements.
- All user-facing strings in ${language}; numbers/units stay natural.`;

    const text = await generateText(prompt, 60000);
    if (!text) {
      console.warn(
        `[recipes/details] Falling back to placeholder content for "${recipeName}" — Gemini text generation returned no usable text. Check earlier [generateText] log lines for the root cause.`
      );
      const fallbackSteps = [
        `Prepare ingredients for ${recipeName}.`,
        `Cook with medium heat and proper seasoning.`,
        `Serve hot.`,
      ];
      const fallbackStructured = {
        ingredients: [],
        steps: fallbackSteps,
        tips: ['Adjust spice level based on preference.'],
        yieldServings: servings,
      };
      return res.status(503).json({
        degraded: true,
        message:
          'Recipe generator is temporarily unavailable. Please try again in a moment.',
        dishName: String(recipeName),
        recipe: joinStructuredRecipe(fallbackStructured, language),
        ...fallbackStructured,
        imageUrl: buildDishImageUrl(`${recipeName}, food, ${cuisine}`),
        nutritionEstimate: { caloriesKcal: null, proteinG: null, carbsG: null },
      });
    }

    let parsed;
    try {
      const jsonChunk = text.match(/\{[\s\S]*\}/)?.[0] || text;
      parsed = JSON.parse(jsonChunk);
    } catch {
      parsed = { dishName: String(recipeName), recipe: text };
    }

    const dishName = typeof parsed.dishName === 'string' && parsed.dishName.trim()
      ? parsed.dishName.trim()
      : String(recipeName);

    // Structured-first: prefer arrays returned by the model. Fall back to deriving
    // them from the legacy `recipe` string only if the model ignored the schema.
    let structured = readStructuredRecipeFromPayload(parsed);
    const legacyRecipeText = typeof parsed.recipe === 'string' ? parsed.recipe : '';
    if (!structured.steps.length && legacyRecipeText.trim()) {
      structured = deriveStructuredFromText(legacyRecipeText);
    }
    if (!structured.steps.length) {
      // Model produced neither arrays nor `recipe` text — last-resort: use the raw
      // generation as a single step so the user still sees something usable.
      structured = { ingredients: [], steps: [text.trim()], tips: [], yieldServings: servings };
    }
    if (structured.yieldServings == null) structured.yieldServings = servings;

    const recipeJoined = joinStructuredRecipe(structured, language);

    const parsedNutrition =
      parsed?.nutritionEstimate && typeof parsed.nutritionEstimate === 'object' ? parsed.nutritionEstimate : {};
    const nutritionEstimate = {
      caloriesKcal:
        typeof parsedNutrition.caloriesKcal === 'number' && Number.isFinite(parsedNutrition.caloriesKcal)
          ? Math.max(0, Math.round(parsedNutrition.caloriesKcal))
          : null,
      proteinG:
        typeof parsedNutrition.proteinG === 'number' && Number.isFinite(parsedNutrition.proteinG)
          ? Math.max(0, Math.round(parsedNutrition.proteinG))
          : null,
      carbsG:
        typeof parsedNutrition.carbsG === 'number' && Number.isFinite(parsedNutrition.carbsG)
          ? Math.max(0, Math.round(parsedNutrition.carbsG))
          : null,
    };
    const rawImagePrompt =
      typeof parsed.imagePrompt === 'string' && parsed.imagePrompt.trim()
        ? parsed.imagePrompt.trim()
        : `${dishName} ${cuisine} food`;
    const imagePrompt = buildDishSpecificImagePrompt({
      dishName,
      cuisine,
      queryText: userQuery,
      basePrompt: rawImagePrompt,
    });
    let imageUrl = '';
    if (includeImage) {
      imageUrl = await generateImageFromGeminiWithRetry(imagePrompt);
      if (!imageUrl) {
        return res.status(503).json({
          message: 'Gemini image is temporarily unavailable. Please try again in a moment.',
          ...(BILLING_ENABLED && installId ? { billing: billingSnapshot(ensureWallet(installId)) } : {}),
        });
      }
    }

    const billingAfter =
      BILLING_ENABLED && installId ? applySuccessfulRecipeCharge(installId, includeImage) : undefined;

    const payloadForCache = {
      dishName,
      recipe: recipeJoined,
      ingredients: structured.ingredients,
      steps: structured.steps,
      tips: structured.tips,
      yieldServings: structured.yieldServings,
      imageUrl,
      nutritionEstimate,
    };
    recipeDetailsCache.set(cacheKey, payloadForCache, TTL_RECIPE_DETAILS);
    return res.json({
      ...payloadForCache,
      ...(billingAfter ? { billing: billingAfter } : {}),
    });
  } catch (error) {
    console.error('recipes/details failed:', error);
    return res.status(500).json({
      message: error instanceof Error ? error.message : 'Failed to generate recipe details',
    });
  }
});

app.post('/api/v1/ai/recipes/shopping-list', async (req, res) => {
  try {
    const {
      recipeText = '',
      ingredients: structuredIngredients,
      dishName = 'Recipe',
      language = 'English',
      servings: rawServings,
    } = req.body || {};
    const body = String(recipeText || '').trim();
    const structuredList = coerceStringArray(structuredIngredients);
    if (!body && !structuredList.length) {
      return res.status(400).json({ message: 'recipeText or ingredients is required' });
    }

    const servings = coerceServings(rawServings);
    const servingsHint = servings !== 4 ? `Scaled for ~${servings} people. ` : '';

    // Cache key prefers the structured ingredient list when present (cheap +
    // deterministic). Falls back to the recipe text. Either way, identical
    // input → identical normalized output, so caching is safe.
    const noCache = req.body?.nocache === true || req.query?.nocache === '1';
    const cacheKey = canonicalKey('recipes/shopping-list', {
      dishName,
      language,
      servings,
      ingredients: structuredList.length ? structuredList : null,
      recipeText: structuredList.length ? null : body.slice(0, 6000),
    });
    if (!noCache) {
      const cached = shoppingListCache.get(cacheKey);
      if (cached) {
        return res.json({ ...cached, cached: true });
      }
    }

    // Prefer the structured ingredient array (cheap, deterministic). The legacy
    // free-form fallback is capped at 6k chars to keep input tokens bounded —
    // recipes never need that much for ingredient extraction.
    const sourceBlock = structuredList.length
      ? `Ingredients (one per line):\n${structuredList.slice(0, 80).join('\n')}`
      : `Recipe:\n"""\n${body.slice(0, 6000)}\n"""`;

    const prompt = `Extract a grocery shopping list from this recipe.
Dish: "${String(dishName).slice(0, 200)}". ${servingsHint}${sourceBlock}

Return ONLY a JSON array of strings. Each string is ONE ingredient NAME ONLY (no amounts, no units like cups/tsp/grams/কাপ/চামচ/কেজি). Language: ${language}. Merge duplicates. Proteins/main veg first, then spices/pantry. Max 35 items.`;

    const text = await generateText(prompt, 25000);
    let items = parseStringArrayJson(text || '');
    if (!items.length) {
      console.warn(
        `[shopping-list] Gemini did not return a usable JSON array; falling back to local extraction (structuredIngredients=${structuredList.length}, recipeText=${body.length}chars).`
      );
      items = structuredList.length
        ? structuredList.map((line) => line.replace(/^[\d./\s]+[a-zA-Z\u0980-\u09FF\u0900-\u097F\u0600-\u06FF]*\s*/, '').trim()).filter(Boolean)
        : fallbackShoppingItemsFromRecipe(body);
    }
    if (!items.length) {
      return res.status(502).json({ message: 'Could not build shopping list' });
    }
    const payload = { items };
    shoppingListCache.set(cacheKey, payload, TTL_SHOPPING_LIST);
    return res.json(payload);
  } catch (error) {
    console.error('recipes/shopping-list failed:', error);
    return res.status(500).json({
      message: error instanceof Error ? error.message : 'Failed to generate shopping list',
    });
  }
});

app.post('/api/v1/ai/ingredients/recognize', async (req, res) => {
  try {
    const { imageBase64 = '', language = 'English' } = req.body || {};
    const rawImage = String(imageBase64 || '').trim();
    if (!rawImage) {
      return res.status(400).json({ message: 'imageBase64 is required' });
    }

    const dataUrlMatch = rawImage.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/);
    const mimeType = dataUrlMatch?.[1] || 'image/jpeg';
    const base64Data = (dataUrlMatch?.[2] || rawImage).replace(/\s+/g, '');

    if (!base64Data || base64Data.length < 120) {
      return res.status(400).json({ message: 'imageBase64 is invalid' });
    }

    const prompt = `You are an ingredient recognizer for cooking.
Look at the provided food/ingredient image and list likely raw ingredients visible in the image.
Rules:
- Return ONLY a JSON array of strings.
- Each item must be a short ingredient name (no quantity, no brand, no sentence).
- Max 20 items.
- If confidence is low, return fewer items.
- Use language: ${language}.`;

    const text = await generateTextFromImage({ prompt, base64Data, mimeType }, 30000);
    const items = parseStringArrayJson(text || '').slice(0, 20);
    if (!items.length) {
      return res.status(502).json({ message: 'Could not recognize ingredients from image' });
    }
    return res.json({ ingredients: items });
  } catch (error) {
    console.error('ingredients/recognize failed:', error);
    return res.status(500).json({
      message: error instanceof Error ? error.message : 'Failed to recognize ingredients',
    });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`ChefAI backend running at http://0.0.0.0:${PORT}`);
});
