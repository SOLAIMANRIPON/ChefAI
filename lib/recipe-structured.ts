/**
 * Canonical structured shape for an AI-generated recipe.
 *
 * Why this exists: Gemini (and any LLM) returns free-form recipe text in a
 * different shape every time it's called — sometimes multi-line numbered,
 * sometimes a single paragraph, sometimes with headers like "Ingredients:" /
 * "Yields:", sometimes without. Heuristically parsing that on the client breaks
 * every time the model picks a new format.
 *
 * The fix is to ask the model for *arrays* (one ingredient / step per element),
 * persist those arrays end-to-end (server → storage → cook mode), and only fall
 * back to text parsing for legacy data that pre-dates this contract.
 */

import { parseRecipeSteps } from './recipe-steps';

export type StructuredRecipe = {
  /** Each item is one ingredient line, e.g. "1.5 lbs flank steak (sliced…)". */
  ingredients: string[];
  /** Each item is one cooking step, with no number prefix and no "Step N:" wrapper. */
  steps: string[];
  /** Optional cooking tips. */
  tips: string[];
  /** e.g. 4. Null/undefined when not stated. */
  yieldServings?: number | null;
};

const SECTION_HEADERS_BY_LANGUAGE: Record<
  string,
  { ingredients: string; instructions: string; tips: string; yieldsLabel: string; servingsLabel: string }
> = {
  বাংলা: {
    ingredients: 'উপকরণ',
    instructions: 'নির্দেশনা',
    tips: 'টিপস',
    yieldsLabel: 'পরিবেশন',
    servingsLabel: 'জন',
  },
  English: {
    ingredients: 'Ingredients',
    instructions: 'Instructions',
    tips: 'Tips',
    yieldsLabel: 'Yields',
    servingsLabel: 'servings',
  },
  Hindi: {
    ingredients: 'सामग्री',
    instructions: 'निर्देश',
    tips: 'सुझाव',
    yieldsLabel: 'परिमाण',
    servingsLabel: 'सर्विंग्स',
  },
  Arabic: {
    ingredients: 'المكونات',
    instructions: 'التعليمات',
    tips: 'نصائح',
    yieldsLabel: 'الكمية',
    servingsLabel: 'حصص',
  },
  Urdu: {
    ingredients: 'اجزاء',
    instructions: 'ہدایات',
    tips: 'تجاویز',
    yieldsLabel: 'مقدار',
    servingsLabel: 'حصص',
  },
  Spanish: {
    ingredients: 'Ingredientes',
    instructions: 'Instrucciones',
    tips: 'Consejos',
    yieldsLabel: 'Rinde',
    servingsLabel: 'porciones',
  },
  French: {
    ingredients: 'Ingrédients',
    instructions: 'Instructions',
    tips: 'Astuces',
    yieldsLabel: 'Portions',
    servingsLabel: 'portions',
  },
};

export function getRecipeSectionLabels(language: string | undefined) {
  return SECTION_HEADERS_BY_LANGUAGE[language ?? ''] ?? SECTION_HEADERS_BY_LANGUAGE.English;
}

/**
 * Build a clean human-readable recipe text from structured arrays. This is what
 * we persist as the `recipe` string field for backward compatibility (saved
 * storage, shopping-list extractor, plain-text display) — but downstream cook
 * mode and ingredient list now consume the arrays directly.
 *
 * The output uses the user's language for section headers so that
 * `parseRecipeSteps` continues to work even if a future client only sees the
 * legacy text form.
 */
export function joinStructuredRecipe(structured: StructuredRecipe, language?: string): string {
  const labels = getRecipeSectionLabels(language);
  const parts: string[] = [];
  if (structured.yieldServings != null && Number.isFinite(structured.yieldServings)) {
    parts.push(`${labels.yieldsLabel}: ${structured.yieldServings} ${labels.servingsLabel}.`);
  }
  if (structured.ingredients.length) {
    parts.push(`${labels.ingredients}:`);
    for (const item of structured.ingredients) {
      const trimmed = item.trim();
      if (trimmed) parts.push(`• ${trimmed}`);
    }
  }
  if (structured.steps.length) {
    if (parts.length) parts.push('');
    parts.push(`${labels.instructions}:`);
    structured.steps.forEach((step, i) => {
      const trimmed = step.trim();
      if (trimmed) parts.push(`${i + 1}. ${trimmed}`);
    });
  }
  if (structured.tips.length) {
    if (parts.length) parts.push('');
    parts.push(`${labels.tips}:`);
    for (const tip of structured.tips) {
      const trimmed = tip.trim();
      if (trimmed) parts.push(`• ${trimmed}`);
    }
  }
  return parts.join('\n');
}

/** Best-effort coercion of unknown JSON into a clean string array, capped at 80 entries. */
export function coerceStringArray(value: unknown, max = 80): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const v of value) {
    if (typeof v === 'string') {
      const trimmed = v.trim();
      if (trimmed) out.push(trimmed);
    } else if (v && typeof v === 'object') {
      const candidate =
        (typeof (v as { text?: unknown }).text === 'string' && (v as { text: string }).text) ||
        (typeof (v as { name?: unknown }).name === 'string' && (v as { name: string }).name) ||
        (typeof (v as { value?: unknown }).value === 'string' && (v as { value: string }).value) ||
        '';
      const trimmed = String(candidate).trim();
      if (trimmed) out.push(trimmed);
    }
    if (out.length >= max) break;
  }
  return out;
}

/**
 * Read structured fields from an arbitrary backend / saved-storage payload.
 * Falls back to empty arrays — callers can then derive them from the legacy
 * `recipe` string with `deriveStructuredFromText`.
 */
export function readStructuredRecipeFromPayload(payload: unknown): StructuredRecipe {
  if (!payload || typeof payload !== 'object') {
    return { ingredients: [], steps: [], tips: [], yieldServings: null };
  }
  const obj = payload as Record<string, unknown>;
  const yieldRaw = obj.yieldServings;
  let yieldServings: number | null = null;
  if (typeof yieldRaw === 'number' && Number.isFinite(yieldRaw)) {
    yieldServings = Math.round(yieldRaw);
  } else if (typeof yieldRaw === 'string' && yieldRaw.trim()) {
    const n = Number.parseInt(yieldRaw.trim(), 10);
    if (Number.isFinite(n)) yieldServings = n;
  }
  return {
    ingredients: coerceStringArray(obj.ingredients),
    steps: coerceStringArray(obj.steps),
    tips: coerceStringArray(obj.tips),
    yieldServings,
  };
}

/**
 * Last-resort fallback for legacy data: extract steps (and a best-effort
 * ingredients block) from a free-form recipe string. Used only when the source
 * has no structured arrays — never preferred over real arrays from the model.
 */
export function deriveStructuredFromText(recipeText: string): StructuredRecipe {
  const text = (recipeText ?? '').trim();
  if (!text) return { ingredients: [], steps: [], tips: [], yieldServings: null };

  const steps = parseRecipeSteps(text);
  const ingredients = extractIngredientsFromText(text);
  return { ingredients, steps, tips: [], yieldServings: null };
}

/**
 * Heuristic: pull bullet/comma-separated ingredient items out of a legacy
 * recipe string by anchoring on the "Ingredients:" header (multilingual).
 * Lossy by design — only used when no structured array is available.
 */
function extractIngredientsFromText(text: string): string[] {
  const ingredientHeaders = ['ingredients', 'উপকরণ', 'सामग्री', 'مكونات', 'اجزاء', 'ingredientes', 'ingrédients'];
  const instructionHeaders = ['instructions', 'directions', 'method', 'steps', 'নির্দেশনা', 'নির্দেশ', 'पकाने', 'विधि', 'تعليمات', 'طريقة', 'instrucciones'];
  const lower = text.toLowerCase();

  let start = -1;
  for (const h of ingredientHeaders) {
    const idx = lower.indexOf(h.toLowerCase());
    if (idx >= 0 && (start === -1 || idx < start)) start = idx;
  }
  if (start === -1) return [];
  const afterHeader = text.slice(start).match(/^[^:：—–\-\n]+[:：—–\-\n]\s*/u);
  if (!afterHeader) return [];
  const sliceStart = start + afterHeader[0].length;
  let sliceEnd = text.length;
  const remainderLower = text.slice(sliceStart).toLowerCase();
  for (const h of instructionHeaders) {
    const idx = remainderLower.indexOf(h.toLowerCase());
    if (idx >= 0 && idx < sliceEnd - sliceStart) sliceEnd = sliceStart + idx;
  }

  const ingredientsBlock = text.slice(sliceStart, sliceEnd).trim();
  if (!ingredientsBlock) return [];

  const lines = ingredientsBlock.split(/\n/).map((l) => l.trim()).filter(Boolean);
  const bulletLines = lines
    .filter((l) => /^[•\-\*]\s/.test(l))
    .map((l) => l.replace(/^[•\-\*]\s+/, '').trim())
    .filter(Boolean);
  if (bulletLines.length >= 2) return bulletLines.slice(0, 80);

  return ingredientsBlock
    .split(/[,;\n]+/)
    .map((s) => s.replace(/^[•\-\*]\s+/, '').trim())
    .filter(Boolean)
    .slice(0, 80);
}
