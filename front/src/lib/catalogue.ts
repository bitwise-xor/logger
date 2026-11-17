/**
 * Library's Foods tab (deploy 105): the door's Catalogue and a food's box (docs/API.md, "Library (104): the food catalogue"), and the
 * plain rules the page needs: the page's address (?q=, ?f=, ?s=, ?food=), a row's lines, what changed in the values form, and the
 * fields of each form. Plain TypeScript, so the tests need no browser; the state is cataloguepage.svelte.ts.
 */
import type { FieldValues } from './saver.js';

export const CATALOGUE_FILTERS = ['all', 'drinks', 'new', 'review'] as const;
export const CATALOGUE_SORTS = ['eaten', 'recent', 'last', 'added', 'kcal', 'kcal_low', 'protein', 'name'] as const;
export type CatalogueFilter = (typeof CATALOGUE_FILTERS)[number];
export type CatalogueSort = (typeof CATALOGUE_SORTS)[number];

export interface Per100 {
  kcal: number | null;
  protein: number | null;
  fat: number | null;
  carbs: number | null;
}

export interface CatalogueRow {
  id: number;
  ref: string;
  name: string;
  review: boolean;
  drink: boolean;
  aliases: string[];
  basis: 'g' | 'ml';
  per_100: Per100;
  per_100_text: Record<keyof Per100, string>;
  eaten: number;
  last: string | null;
  last_text: string;
  added: string;
  added_text: string;
}

export interface Catalogue {
  q: string;
  filter: CatalogueFilter;
  sort: CatalogueSort;
  filters: { key: CatalogueFilter; label: string; on: boolean }[];
  sorts: { key: CatalogueSort; label: string; on: boolean }[];
  count: number;
  limit: number;
  more: string | null;
  empty: string | null;
  hint: string;
  placeholder: string;
  rows: CatalogueRow[];
}

export type ValueKey = 'kcal' | 'protein' | 'fat' | 'sat_fat' | 'carbs' | 'fibre' | 'sugar_total' | 'sugar_added' | 'sodium_mg' | 'caffeine_mg';

export interface Item {
  id: number;
  ref: string;
  name: string;
  basis: 'g' | 'ml';
  source: { text: string; line: string; source: string; brand: string | null; note: string | null };
  needs_review: boolean;
  review_reason: string | null;
  values: { key: ValueKey; label: string; value: number | null }[];
  aliases: string[];
  drink: boolean;
  active: boolean;
  units: { unit: string; grams: number; text: string }[];
  barcode: string | null;
  eaten: number;
  first: string | null;
  last: string | null;
  last_text: string | null;
  added: string;
  added_text: string;
  recipe: string | null;
  values_editable: boolean;
  past: null | { n: number; text: string };
  words: { values_hint: string; basics_hint: string; none: string; review: string; reviewed: string };
  limits: {
    name_min: number;
    name_max: number;
    word_max: number;
    words_max: number;
    unit_max: number;
    grams_max: number;
    barcode_min: number;
    barcode_max: number;
  };
}

/** The door's answer when a food is not there (GET /food/item's 404 no_entry). */
export const GONE = 'That food is not there any more.';

// ---- the page's address ----------------------------------------------------------------------------------------------------------

export interface View {
  q: string;
  f: CatalogueFilter;
  s: CatalogueSort;
  /** The open food's id (?food=N12), or none. */
  food: number | null;
}

export const askedFilter = (x: string | null): CatalogueFilter => ((CATALOGUE_FILTERS as readonly string[]).includes(x ?? '') ? (x as CatalogueFilter) : 'all');
export const askedSort = (x: string | null): CatalogueSort => ((CATALOGUE_SORTS as readonly string[]).includes(x ?? '') ? (x as CatalogueSort) : 'eaten');
/** ?food= as the door takes it ("N12", "n12" or "12"); anything else is none. */
export function askedFood(x: string | null): number | null {
  const m = /^[Nn]?(\d{1,9})$/.exec(x?.trim() ?? '');
  return m && Number(m[1]) > 0 ? Number(m[1]) : null;
}
/** The search as the door takes it (cut at 60). */
export const askedQ = (x: string | null) => (x ?? '').trim().slice(0, 60);

export function viewOf(params: URLSearchParams): View {
  return { q: askedQ(params.get('q')), f: askedFilter(params.get('f')), s: askedSort(params.get('s')), food: askedFood(params.get('food')) };
}

/** The page's address for a view: the defaults are left out (/library is all foods, most eaten, none open). */
export function catalogueHref(v: Partial<View>): string {
  const p = new URLSearchParams();
  const q = askedQ(v.q ?? '');
  if (q) p.set('q', q);
  if (v.f && v.f !== 'all') p.set('f', v.f);
  if (v.s && v.s !== 'eaten') p.set('s', v.s);
  if (v.food) p.set('food', `N${v.food}`);
  const t = p.toString();
  return t ? `/library?${t}` : '/library';
}

/** What every save of the page carries, so its answer brings the list and the box as shown (view "catalogue"). */
export function viewFields(v: View): FieldValues {
  const out: FieldValues = { view: 'catalogue', view_f: v.f, view_s: v.s };
  if (v.q) out.view_q = v.q;
  if (v.food) out.view_food = String(v.food);
  return out;
}

// ---- a row --------------------------------------------------------------------------------------------------------------------

/** "372 kcal · P 13.5 · F 7 · C 58.7" (as app.'s table prints them). */
export function macroLine(r: Pick<CatalogueRow, 'per_100_text'>): string {
  const t = r.per_100_text;
  return `${t.kcal} kcal · P ${t.protein} · F ${t.fat} · C ${t.carbs}`;
}
export const perLine = (r: { basis: 'g' | 'ml' }) => `per 100 ${r.basis}`;
/** "Eaten 5× · Last 16.11. · Added 01.05.26" (tablet width and up). */
export const statsLine = (r: CatalogueRow) => `Eaten ${r.eaten}× · Last ${r.last_text} · Added ${r.added_text}`;
export const countLine = (c: Pick<Catalogue, 'count'>) => `${c.count} ${c.count === 1 ? 'food' : 'foods'}`;

// ---- the values form ------------------------------------------------------------------------------------------------------------

/** What the form shows: each value as text, an unknown one empty (its placeholder says "unknown"). */
export function valuesDraft(item: Pick<Item, 'values'>): Record<ValueKey, string> {
  return Object.fromEntries(item.values.map((v) => [v.key, v.value === null ? '' : String(v.value)])) as Record<ValueKey, string>;
}

/** A typed value as a number ("12,5" too); null when it is not one. */
export function typedNumber(t: string): number | null {
  const n = t.trim().replace(',', '.');
  return /^\d{1,6}(\.\d{1,4})?$/.test(n) ? Number(n) : null;
}

/**
 * Only the values the owner changed (the door keeps one left out as it is), or why the form cannot be sent (app.'s words): a known
 * value cleared ("an unknown value cannot be set here"), something that is not a number of 0 or more.
 */
export function valueChanges(item: Pick<Item, 'values'>, draft: Record<string, string>): { changed: Partial<Record<ValueKey, number>>; problem: string | null } {
  const changed: Partial<Record<ValueKey, number>> = {};
  for (const v of item.values) {
    const t = (draft[v.key] ?? '').trim();
    if (t === '') {
      if (v.value !== null) return { changed: {}, problem: `${v.label}: give a number (an unknown value cannot be set here).` };
      continue;
    }
    const n = typedNumber(t);
    if (n === null) return { changed: {}, problem: `${v.label}: give a number of 0 or more.` };
    if (v.value === null || Math.abs(n - v.value) > 1e-9) changed[v.key] = n;
  }
  return { changed, problem: null };
}

/** The values form's fields: the food, the changed values, the tick "Also change past entries". */
export function valuesFields(id: number, changed: Partial<Record<ValueKey, number>>, past: boolean): FieldValues {
  const out: FieldValues = { id: String(id) };
  for (const [k, n] of Object.entries(changed)) out[k] = String(n);
  if (past) out.past = '1';
  return out;
}

export const wordFields = (id: number, act: 'add' | 'remove', word: string): FieldValues => ({ id: String(id), act, word });
export const barcodeFields = (id: number, barcode: string): FieldValues => ({ id: String(id), barcode });
export const unitFields = (id: number, unit: string, grams: string): FieldValues => ({ id: String(id), unit, grams });
/** A unit's weight that is not a number would be the door's plain 400: said first, in app.'s words for a weight out of range. */
export function unitProblem(grams: string, item: Pick<Item, 'basis' | 'limits'>): string | null {
  return grams.trim() === '' || typedNumber(grams) !== null ? null : `Give its weight as a number above 0 and at most ${item.limits.grams_max} ${item.basis}.`;
}
export function basicsFields(id: number, name: string, drink: boolean, hide: boolean): FieldValues {
  const out: FieldValues = { id: String(id), name };
  if (drink) out.drink = '1';
  if (hide) out.hide = '1';
  return out;
}

/** Which form a save belongs to: its refusal is said next to it. */
export function formOf(action: string, fields: FieldValues): string | null {
  switch (action) {
    case 'catalogue_values':
      return 'values';
    case 'catalogue_words':
      return fields.act === 'remove' ? 'words' : 'word';
    case 'catalogue_barcode':
      return 'barcode';
    case 'catalogue_basics':
      return 'basics';
    case 'catalogue_unit':
      return 'unit';
    case 'catalogue_reviewed':
      return 'review';
    case 'lookup':
    case 'answer':
      return 'new';
    default:
      return null;
  }
}

/** The look-up's question in an answer (tool "lookup_confirm": "Add this food?" with Yes and No), or none. */
export function lookupQuestion(a: { questions: { id: string; tool: string; answers: { reply: string; label: string }[] }[] }) {
  const q = a.questions.find((x) => x.tool === 'lookup_confirm');
  if (!q) return null;
  const yes = q.answers.find((x) => x.reply === 'yes');
  const no = q.answers.find((x) => x.reply === 'no');
  return { id: q.id, yes: yes?.label ?? 'Yes', no: no?.label ?? 'No' };
}

/** The rows a save added (in the fresh list, not in the one shown before): a new food gets a blue edge. */
export function addedIds(before: Catalogue | null, after: Catalogue): number[] {
  const had = new Set(before?.rows.map((r) => r.id));
  return after.rows.filter((r) => !had.has(r.id)).map((r) => r.id);
}
