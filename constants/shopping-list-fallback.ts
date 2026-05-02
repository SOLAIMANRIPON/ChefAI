/**
 * Offline extraction when POST /recipes/shopping-list fails.
 * Simple rule: parse only ingredient section, avoid cooking instructions.
 */

const SECTION_START_RE = /(ingredients|উপকরণ|প্রয়োজনীয়\s+উপকরণ|প্রয়োজনীয়\s+উপকরণ|উপকরণসমূহ)\s*:?/i;
const SECTION_END_RE = /(প্রস্তুতি|পদ্ধতি|প্রস্তুত\s*ও\s*পদ্ধতি|ধাপ|রান্নার\s*ধাপ|step|method|preparation)\s*:?/i;

/** Narrative cooking steps — not supermarket lines */
export function looksLikeCookingStep(line: string): boolean {
  const s = line.trim();
  if (!s) return true;
  if (/উপকরণ\s*:/i.test(s)) return false;
  if (s.length > 130) return true;
  return /কড়াইতে|কড়াইতে|প্যানে|চুলায়|চুলায়|ভেজে|রান্না|নাড়াচাড়া|নাড়াচাড়া|ঢেলে|কষিয়ে|কষিয়ে|মাঝারি\s*আঁচ|আঁচে|মিনিট|ধুয়ে|ধুয়ে|মেখে|ফোটান|নামিয়ে|নামিয়ে|দিন\b|করুন\b|নিন\b/i.test(
    s
  );
}

function stripLeadingEnumeration(line: string): string {
  return line
    .replace(/^[০-৯\d]+[\).\:\-\s।]+\s*/, '')
    .replace(/^[\u2022•\-\*○◎]\s*/, '')
    .trim();
}

function splitIngredientTokens(text: string): string[] {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\n+/g, '\n')
    .split(/[\n,،，]/)
    .map((x) => stripLeadingEnumeration(x))
    .map((x) => x.replace(/^উপকরণ\s*:\s*/i, '').trim())
    .filter(Boolean);
}

export function extractShoppingItemsFromRecipeText(recipeText: string): string[] {
  const raw = String(recipeText || '').replace(/\*\*/g, '').trim();
  if (!raw) return [];

  // 1) Best path: dedicated ingredient section
  const start = raw.search(SECTION_START_RE);
  if (start !== -1) {
    const afterStart = raw.slice(start);
    const startMatch = afterStart.match(SECTION_START_RE);
    const bodyStart = startMatch ? (startMatch.index ?? 0) + startMatch[0].length : 0;
    const sectionBody = afterStart.slice(bodyStart);
    const end = sectionBody.search(SECTION_END_RE);
    const ingredientBlock = (end === -1 ? sectionBody : sectionBody.slice(0, end)).trim();
    const tokens = splitIngredientTokens(ingredientBlock).filter((x) => !looksLikeCookingStep(x));
    if (tokens.length) return tokens.slice(0, 40);
  }

  // 2) Fallback: first 8 lines before preparation-like markers
  const lines = raw.split('\n').map((x) => x.trim()).filter(Boolean);
  const until = lines.findIndex((x) => SECTION_END_RE.test(x));
  const head = (until === -1 ? lines : lines.slice(0, until)).slice(0, 8).join('\n');
  const tokens = splitIngredientTokens(head).filter((x) => !looksLikeCookingStep(x));
  return tokens.slice(0, 25);
}
