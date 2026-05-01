const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { GoogleGenerativeAI } = require('@google/generative-ai');

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 3000);
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

app.use(cors());
app.use(express.json({ limit: '1mb' }));

const parseRecipeList = (text) =>
  text
    .split('\n')
    .map((line) => line.replace(/^\s*\d+[\).\-\s]*/, '').trim())
    .filter(Boolean)
    .slice(0, 10);

const buildDishImageUrl = (seedText) => {
  const label = encodeURIComponent(String(seedText || 'ChefAI Food').slice(0, 40));
  return `https://placehold.co/1024x768/111111/d3b275?text=${label}`;
};

async function generateText(prompt, timeoutMs = 30000) {
  if (!GEMINI_API_KEY) return null;
  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
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

      if (isTemporaryOverload && attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 1200));
        continue;
      }

      // For temporary provider-side overload, fail gracefully to fallback recipes.
      if (isTemporaryOverload) return null;
      throw error;
    }
  }

  return null;
}

async function generateImageFromGemini(imagePrompt, timeoutMs = 45000) {
  if (!GEMINI_API_KEY) return null;
  const finalPrompt = `${imagePrompt}, ultra realistic food photography, natural light, close-up plated dish, no text, no watermark`;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent?key=${encodeURIComponent(
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

  if (
    combined.includes('পাবদা') ||
    combined.includes('সরষে') ||
    combined.includes('sorshe') ||
    combined.includes('sorse') ||
    combined.includes('pabda')
  ) {
    return `${base}, Bangladeshi sorshe pabda fish curry, pabda fish pieces in yellow mustard gravy, green chili, turmeric tone, served in a Bengali home-style steel or ceramic bowl, top-down or 45 degree food photography, realistic cooked fish texture, no humans, no cats, no animals other than cooked fish, no street scene, no text, no watermark`;
  }

  return `${base}, authentic ${cuisine} dish, accurate ingredients and natural colors`;
};

app.get('/api/v1/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'ChefAI backend',
    geminiConfigured: Boolean(GEMINI_API_KEY),
    timestamp: new Date().toISOString(),
  });
});

app.post('/api/v1/ai/recipes/list', async (req, res) => {
  try {
    const { query, ingredient, cuisine = 'Bangladeshi', language = 'বাংলা' } = req.body || {};
    const userQuery = String(query || ingredient || '').trim();

    if (!userQuery) {
      return res.status(400).json({ message: 'query or ingredient is required' });
    }

    const prompt = `You are ChefAI.
Create exactly 10 popular ${cuisine} recipe names based on this user input: "${userQuery}".
The input may be an ingredient name or a dish name.
Return only the list in ${language}, one line each.`;

    const text = await generateText(prompt, 25000);
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
    const { recipeName = 'Recipe', query = '', ingredient = '', cuisine = 'Bangladeshi', language = 'বাংলা' } = req.body || {};
    const userQuery = String(query || ingredient || '').trim();

    const prompt = `Create a complete ${cuisine} recipe in ${language}.
Recipe target: "${recipeName}".
User input context (ingredient or dish): "${userQuery}".
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

app.listen(PORT, '0.0.0.0', () => {
  console.log(`ChefAI backend running at http://0.0.0.0:${PORT}`);
});
