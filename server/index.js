const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { GoogleGenerativeAI } = require('@google/generative-ai');

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 3000);
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_TEXT_MODEL = (process.env.GEMINI_TEXT_MODEL || 'gemini-3.1-flash-lite-preview').trim();
const GEMINI_IMAGE_MODEL = (process.env.GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image').trim();

app.use(cors());
app.use(express.json({ limit: '1mb' }));

const normalizeGenerationMode = (mode) => (mode === 'creative' ? 'creative' : 'strict');

const normalizeDietPreference = (value) =>
  value === 'vegetarian' || value === 'vegan' || value === 'gluten_free' ? value : 'none';

const normalizeSpiceLevel = (value) =>
  value === 'mild' || value === 'medium' || value === 'hot' ? value : 'medium';

const coerceCalories = (raw) => {
  if (raw === undefined || raw === null || raw === '') return null;
  const n = typeof raw === 'number' ? raw : Number.parseInt(String(raw).replace(/\D/g, ''), 10);
  if (!Number.isFinite(n) || n < 1 || n > 8000) return null;
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

async function generateText(prompt, timeoutMs = 30000) {
  if (!GEMINI_API_KEY) return null;
  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: GEMINI_TEXT_MODEL });
  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Gemini timeout')), timeoutMs);
      });

      const resultPromise = model.generateContent(prompt);
      const result = await Promise.race([resultPromise, timeoutPromise]);
      const text = result.response.text();
      return text || null;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
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

      if (isTemporaryOverload && attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 1200));
        continue;
      }

      // For temporary provider-side overload, fail gracefully to fallback recipes.
      if (isTemporaryOverload) return null;
      // For timeout, return null so endpoints can use fallback payload.
      if (isTimeout) return null;
      // For exhausted credits/quota, return null so endpoints can use fallback response.
      if (isQuotaOrBillingIssue) return null;
      throw error;
    }
  }

  return null;
}

const IMAGE_PROMPT_GLOBAL_SUFFIX =
  'ultra realistic food photography, natural soft light, close-up plated dish in a bowl or plate, no text, no watermark, no logos. Species and ingredient fidelity: depict exactly what the dish text describes; when a specific fish or vegetable is named, match that type — do not substitute a different species or a generic look-alike; for small river fish curries show small whole fish or typical small-fish cuts, not thick circular steaks from large carps unless the dish is explicitly large carp (rohu, katla).';

async function generateImageFromGemini(imagePrompt, timeoutMs = 45000) {
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

async function generateImageFromGeminiWithRetry(imagePrompt, timeoutMs = 45000, maxAttempts = 3) {
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

app.get('/api/v1/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'ChefAI backend',
    geminiConfigured: Boolean(GEMINI_API_KEY),
    textModel: GEMINI_TEXT_MODEL,
    imageModel: GEMINI_IMAGE_MODEL,
    timestamp: new Date().toISOString(),
  });
});

app.post('/api/v1/ai/recipes/list', async (req, res) => {
  try {
    const {
      query,
      ingredient,
      cuisine = 'Bangladeshi',
      language = 'বাংলা',
      generationMode: rawMode,
      dietPreference,
      spiceLevel,
      maxCaloriesPerMeal,
    } = req.body || {};
    const generationMode = normalizeGenerationMode(rawMode);
    const userQuery = String(query || ingredient || '').trim();

    if (!userQuery) {
      return res.status(400).json({ message: 'query or ingredient is required' });
    }

    const modeLine =
      generationMode === 'creative'
        ? `Creative mode: suggest distinctive, appetizing names—including fusion or modern twists where fitting—while staying achievable with common ingredients.`
        : `Strict mode: suggest familiar, reliable ${cuisine} dish names people recognize; classic combinations; avoid gimmicky fusion unless the input clearly asks for it.`;

    const nutritionBlock = buildNutritionConstraints({ dietPreference, spiceLevel, maxCaloriesPerMeal });

    const prompt = `You are ChefAI.
Create exactly 10 ${cuisine} recipe names based on this user input: "${userQuery}".
The input may be an ingredient name or a dish name.
${modeLine}
${nutritionBlock ? `User nutrition preferences (you MUST only suggest dishes that can honor these): ${nutritionBlock}` : ''}
Return only the list in ${language}, one line each.`;

    const text = await generateText(prompt, 35000);
    if (!text) {
      // Safe fallback if key is not configured yet.
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
      return res.json({ recipes: fallbackRecipes });
    }

    const recipes = parseRecipeList(text);
    if (!recipes.length) return res.status(502).json({ message: 'No recipes generated' });
    return res.json({ recipes });
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
      language = 'বাংলা',
      generationMode: rawMode,
      dietPreference,
      spiceLevel,
      maxCaloriesPerMeal,
    } = req.body || {};
    const generationMode = normalizeGenerationMode(rawMode);
    const userQuery = String(query || ingredient || '').trim();

    const modeBlock =
      generationMode === 'creative'
        ? `Writing style: CREATIVE — include tasteful variations (heat level, protein swap, regional twist) where helpful; encourage experimentation while keeping steps clear.`
        : `Writing style: STRICT — conservative, precise steps; typical quantities (cups/tbsp where sensible); minimal improvisation; focus on repeatable results.`;

    const nutritionBlock = buildNutritionConstraints({ dietPreference, spiceLevel, maxCaloriesPerMeal });

    const prompt = `Create a complete ${cuisine} recipe in ${language}.
Recipe target: "${recipeName}".
User input context (ingredient or dish): "${userQuery}".
${modeBlock}
${nutritionBlock ? `User nutrition preferences (apply to ingredients, substitutions, and steps): ${nutritionBlock}` : ''}
Return strict JSON with keys:
{
  "dishName": "string",
  "recipe": "concise step-by-step instructions with tips",
  "imagePrompt": "short english food photo query, include dish name and cuisine"
}`;

    const text = await generateText(prompt, 35000);
    if (!text) {
      return res.json({
        dishName: String(recipeName),
        recipe: `1) Prepare ingredients for ${recipeName}.\n2) Cook with medium heat and proper seasoning.\n3) Serve hot.\n\nTip: Adjust spice level based on preference.`,
        imageUrl: buildDishImageUrl(`${recipeName}, food, ${cuisine}`),
      });
    }

    let parsed;
    try {
      const jsonChunk = text.match(/\{[\s\S]*\}/)?.[0] || text;
      parsed = JSON.parse(jsonChunk);
    } catch {
      parsed = {
        dishName: String(recipeName),
        recipe: text,
      };
    }

    const dishName = typeof parsed.dishName === 'string' ? parsed.dishName : String(recipeName);
    const recipe = typeof parsed.recipe === 'string' ? parsed.recipe : String(text);
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
    const imageUrl = await generateImageFromGeminiWithRetry(imagePrompt, 45000, 3);
    if (!imageUrl) {
      return res.status(503).json({
        message: 'Gemini image is temporarily unavailable. Please try again in a moment.',
      });
    }
    return res.json({ dishName, recipe, imageUrl });
  } catch (error) {
    console.error('recipes/details failed:', error);
    return res.status(500).json({
      message: error instanceof Error ? error.message : 'Failed to generate recipe details',
    });
  }
});

app.post('/api/v1/ai/recipes/shopping-list', async (req, res) => {
  try {
    const { recipeText = '', dishName = 'Recipe', language = 'বাংলা' } = req.body || {};
    const body = String(recipeText || '').trim();
    if (!body) {
      return res.status(400).json({ message: 'recipeText is required' });
    }

    const prompt = `You extract a practical grocery shopping list from a recipe.
Dish: "${String(dishName).slice(0, 200)}"
Recipe text:
"""
${body.slice(0, 12000)}
"""
Return ONLY a JSON array of strings. Each string is ONE ingredient NAME only for grocery shopping — NO amounts, NO units (no cups, tsp, grams, কাপ, চামচ, কেজি, টি counts). Same language as the recipe (${language}). Merge duplicates (e.g. "onion" twice → once). Order: proteins/main veg first, then spices/pantry, max 35 items.`;

    const text = await generateText(prompt, 25000);
    let items = parseStringArrayJson(text || '');
    if (!items.length) {
      items = fallbackShoppingItemsFromRecipe(body);
    }
    if (!items.length) {
      return res.status(502).json({ message: 'Could not build shopping list' });
    }
    return res.json({ items });
  } catch (error) {
    console.error('recipes/shopping-list failed:', error);
    return res.status(500).json({
      message: error instanceof Error ? error.message : 'Failed to generate shopping list',
    });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`ChefAI backend running at http://0.0.0.0:${PORT}`);
});
