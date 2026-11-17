/**
 * Food suggestions in the logging box (deploy 117), with the same rules as app.'s box (suggestFoods in core/app/static/app.js):
 * after 2 letters of the part being typed (from the last comma, semicolon, line break or "and" up to the caret, an amount in
 * front like "150 g " skipped), the foods of the catalogue that match, up to 6. A name, or one of its words, that starts with the
 * letters comes first (also through one of the food's own words, which is then shown beside the name); then the ones that only
 * have the letters inside a word. Within each, the most recently eaten first, then the most eaten. ü, ö, ä and ß match ue, oe, ae
 * and ss. Picking one puts in its name and the amount eaten last ("Oats 60 g").
 * Plain TypeScript, so the unit tests need no browser. The foods come from GET /foods/suggest (through /foods/suggest here).
 */
import { plain } from './format.js';

/** One food as the door sends it (GET /api/v1/foods/suggest): every active food of the catalogue. */
export interface SuggestFood {
  food_id: number;
  name: string;
  unit: 'g' | 'ml';
  /** The food's own words ("muesli" for "Knuspermüsli"). */
  words: string[];
  last_amount: number | null;
  /** How often it was eaten. */
  eaten: number;
  /** When it was eaten last (ISO), or null. */
  last_at: string | null;
}

/** A suggestion: the food, and the word it was found by when not by its name. */
export interface Suggestion {
  food: SuggestFood;
  word: string | null;
}

/** How many suggestions at most, and how many letters before any. */
export const MAX = 6;
export const LETTERS = 2;

/** Lower case, with ü, ö, ä and ß as ue, oe, ae and ss (both ways: "muesli" finds "Müsli"). */
export const fold = (s: string) => s.toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss');

/** A name cut into its words. */
const cut = (s: string) => s.split(/[\s,()/-]+/);

/** The piece being typed: from the last comma, semicolon, line break or "and" up to the caret. start and end: what a pick replaces. */
export function typedPart(value: string, caret: number): { start: number; end: number; q: string } {
  const before = value.slice(0, caret);
  const pieces = (before.split(/[,;\n]/).pop() ?? '').split(/\band\b/i);
  const raw = (pieces[pieces.length - 1] ?? '').replace(/^\s+/, '');
  const q = raw
    .replace(/^\d+([.,]\d+)?\s*(g|ml|x)?\s+/i, '')
    .trim()
    .toLowerCase();
  return { start: before.length - raw.length, end: caret, q };
}

/** How a food matches the letters: 2 a word starts with them, 1 they are inside a word, or none. */
function match(f: SuggestFood, q: string): { s: number; word: string | null } | null {
  const name = fold(f.name);
  if (cut(name).some((w) => w.startsWith(q))) return { s: 2, word: null };
  const words = f.words ?? [];
  const start = words.find((w) => cut(fold(w)).some((x) => x.startsWith(q)));
  if (start) return { s: 2, word: start };
  if (name.includes(q)) return { s: 1, word: null };
  const inside = words.find((w) => fold(w).includes(q));
  return inside ? { s: 1, word: inside } : null;
}

const when = (f: SuggestFood) => {
  const t = f.last_at ? Date.parse(f.last_at) : NaN;
  return Number.isNaN(t) ? 0 : t;
};

/** The suggestions for the letters typed (already the part from typedPart): none under 2 letters. */
export function suggest(foods: SuggestFood[], typed: string, max = MAX): Suggestion[] {
  const q = fold(typed);
  if (q.length < LETTERS) return [];
  const found: { m: { s: number; word: string | null }; f: SuggestFood }[] = [];
  for (const f of foods) {
    const m = match(f, q);
    if (m) found.push({ m, f });
  }
  found.sort((a, b) => b.m.s - a.m.s || when(b.f) - when(a.f) || (b.f.eaten ?? 0) - (a.f.eaten ?? 0));
  return found.slice(0, max).map(({ m, f }) => ({ food: f, word: m.word }));
}

/** The amount eaten last as the box gets it: " 60 g", " 12.5 g", or nothing when it was never eaten. */
export const lastAmount = (f: SuggestFood) => (f.last_amount === null || f.last_amount === undefined ? '' : ` ${plain(Number(f.last_amount.toFixed(1)))} ${f.unit}`);

/** A pick: the typed part replaced by the name and the amount eaten last; the caret right after it. */
export function picked(value: string, caret: number, f: SuggestFood): { value: string; caret: number } {
  const p = typedPart(value, caret);
  const text = f.name + lastAmount(f);
  return { value: value.slice(0, p.start) + text + value.slice(p.end), caret: p.start + text.length };
}

/** The arrows: down to the next (from none: the first), up to the one before (from none: the last); round at the ends. */
export function moved(sel: number, count: number, down: boolean): number {
  if (count <= 0) return -1;
  return (sel + (down ? 1 : count - 1 + (sel < 0 ? 1 : 0))) % count;
}
