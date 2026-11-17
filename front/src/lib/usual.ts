/**
 * The Usual meals page (deploy 87) as the door sends it (GET /api/v1/usual and /foods?q=, docs/API.md) and the editor of one meal:
 * its rows with − and +, swap, remove and add, what changed, the totals before a save, and the fields one Save sends. Plain
 * TypeScript, so the unit tests need no browser. front/tests/samples/usual.json is a real answer of the door.
 */
import type { Nutrients } from './day.js';
import { amountText, stepped } from './food.js';
import { n } from './format.js';
import type { FieldValues } from './saver.js';

// ---- the door's shapes -------------------------------------------------------------------------------------------------------

export interface UsualItem {
  item_id: number;
  food_id: number;
  food: string;
  /** In the food's unit (g, or ml for a drink). */
  amount: number;
  unit: string;
  nutrients: Nutrients;
}

export interface Usual {
  meal_id: number;
  name: string;
  drink: boolean;
  nutrients: Nutrients;
  items: UsualItem[];
}

/** A food of the catalogue, to pick for a meal; per_100 is per 100 g, or per 100 ml (unit). */
export interface FoodHit {
  food_id: number;
  name: string;
  unit: string;
  drink: boolean;
  per_100: Nutrients;
}

// ---- the list ----------------------------------------------------------------------------------------------------------------

export interface Card {
  meal_id: number;
  name: string;
  drink: boolean;
  /** "Oats 60 g · Skyr 200 g". */
  items: string;
  kcal: string;
  protein: string;
}

export const itemText = (i: { food: string; amount: number; unit: string }) => `${i.food} ${amountText(i.amount)} ${i.unit}`;

/** A card per meal, in the door's order (by name). */
export const cards = (list: Usual[]): Card[] =>
  list.map((u) => ({
    meal_id: u.meal_id,
    name: u.name,
    drink: u.drink,
    items: u.items.map(itemText).join(' · '),
    kcal: `${n(u.nutrients.kcal)} kcal`,
    protein: `${n(u.nutrients.protein)} g P`,
  }));

const plural = (k: number, one: string, many: string) => `${k} ${k === 1 ? one : many}`;

/** "4 meals and 2 drinks, by name." */
export function countLine(list: Usual[]): string {
  const drinks = list.filter((u) => u.drink).length;
  return `${plural(list.length - drinks, 'meal', 'meals')} and ${plural(drinks, 'drink', 'drinks')}, by name.`;
}

// ---- the editor --------------------------------------------------------------------------------------------------------------

export interface DraftRow {
  /** "i3" for the meal's item 3, "n1" for a food added here. */
  id: string;
  food_id: number;
  food: string;
  unit: string;
  amount: number;
  /** The food's values per 1 g (or ml): from the item's own values, or from a picked food's per_100. Null when not known. */
  per: Nutrients | null;
  /** The row as saved; null for a food added here. */
  orig: { food_id: number; food: string; unit: string; amount: number } | null;
  removed: boolean;
}

export interface Draft {
  mode: 'edit' | 'new';
  meal_id: number | null;
  name: string;
  /** The saved name ("" for a new meal). */
  origName: string;
  drink: boolean;
  rows: DraftRow[];
}

/** Most foods in a new usual meal (as app.: webfood.NEW_ROWS); a meal that is changed can have up to 40. */
export const NEW_MOST = 8;
export const EDIT_MOST = 40;
/** The door's amounts: above 0 and at most 5000 (g or ml). */
export const AMOUNT_MOST = 5000;

const scale = (x: Nutrients, k: number): Nutrients => ({ kcal: x.kcal * k, protein: x.protein * k, fat: x.fat * k, carbs: x.carbs * k });
const ZERO: Nutrients = { kcal: 0, protein: 0, fat: 0, carbs: 0 };

/** A meal opened to change: its rows as saved. */
export function draftOf(u: Usual): Draft {
  return {
    mode: 'edit',
    meal_id: u.meal_id,
    name: u.name,
    origName: u.name,
    drink: u.drink,
    rows: u.items.map((i) => ({
      id: `i${i.item_id}`,
      food_id: i.food_id,
      food: i.food,
      unit: i.unit,
      amount: i.amount,
      per: i.amount > 0 ? scale(i.nutrients, 1 / i.amount) : null,
      orig: { food_id: i.food_id, food: i.food, unit: i.unit, amount: i.amount },
      removed: false,
    })),
  };
}

export const newDraft = (): Draft => ({ mode: 'new', meal_id: null, name: '', origName: '', drink: false, rows: [] });

/** The rows that stay (not removed). */
export const live = (d: Draft) => d.rows.filter((r) => !r.removed);

/** A row's values at its amount, or null when its food's values are not known. */
export const rowNutrients = (r: DraftRow): Nutrients | null => (r.per ? scale(r.per, r.amount) : null);

/** The meal's values as it stands (the rows that stay); a row whose values are not known counts as 0. */
export const totals = (rows: DraftRow[]): Nutrients =>
  rows.reduce((a, r) => {
    const x = rowNutrients(r) ?? ZERO;
    return { kcal: a.kcal + x.kcal, protein: a.protein + x.protein, fat: a.fat + x.fat, carbs: a.carbs + x.carbs };
  }, ZERO);

/** "354 kcal · 30 g protein". */
export const totalText = (x: Nutrients) => `${n(x.kcal)} kcal · ${n(x.protein)} g protein`;

/** What changed in a row, as the row shows it: "New", "Removed", "Swapped · was Oats, 60 g", "Changed · was 60 g", or "". */
export function rowStatus(r: DraftRow): string {
  if (!r.orig) return 'New';
  if (r.removed) return 'Removed';
  const amount = r.amount !== r.orig.amount;
  if (r.food_id !== r.orig.food_id) return `Swapped · was ${r.orig.food}${amount ? `, ${amountText(r.orig.amount)} ${r.orig.unit}` : ''}`;
  if (amount) return `Changed · was ${amountText(r.orig.amount)} ${r.orig.unit}`;
  return '';
}

/** The name as it will be saved: spaces as the core keeps them (one between words), at most 60 characters. */
export const cleanName = (name: string) => name.split(/\s+/).filter(Boolean).join(' ').slice(0, 60);

export const nameChanged = (d: Draft) => d.mode === 'edit' && cleanName(d.name) !== d.origName;

/** How many changes a Save would make (each changed row, and the name); a new meal counts its rows. */
export const changeCount = (d: Draft) => d.rows.filter((r) => rowStatus(r) !== '').length + (nameChanged(d) ? 1 : 0);

/** "2 changes, not saved yet. One Save for all, one Undo." */
export function changeLine(d: Draft): string {
  if (d.mode === 'new') return 'Saved at once; Undo takes it away again.';
  const k = changeCount(d);
  return k ? `${plural(k, 'change', 'changes')}, not saved yet. One Save for all, one Undo.` : 'Nothing changed yet.';
}

/** What stops a Save before it is sent (the door says the same, in its words, for anything else). */
export function problem(d: Draft): string | null {
  if (cleanName(d.name).length < 2) return 'Give the usual meal a name (at least 2 letters).';
  if (!live(d).length) return d.mode === 'new' ? 'Add at least one food.' : 'A usual meal needs at least one food. To remove the whole meal, use Delete.';
  if (d.mode === 'new' && live(d).length > NEW_MOST) return `Up to ${NEW_MOST} foods in a new usual meal.`;
  return null;
}

/** Whether Save can be pressed: a new meal always (problem() then says what is missing), a meal opened to change once changed. */
export const canSave = (d: Draft) => d.mode === 'new' || changeCount(d) > 0;

/** − and +: 5 at a time under 100, else 25 (as a row of the Food day); never below one step, never above 5000. */
export const more = (amount: number, dir: 1 | -1) => Math.min(AMOUNT_MOST, stepped(amount, 1, dir));

/** A typed amount: a number above 0 and at most 5000, or null. */
export function typedAmount(text: string): number | null {
  const t = text.trim().replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(t)) return null;
  const x = Number(t);
  return x > 0 && x <= AMOUNT_MOST ? x : null;
}

/** A picked food as a new row: 100 g, or 200 ml for a drink (the mockup). */
export function addedRow(hit: FoodHit, id: string): DraftRow {
  return {
    id,
    food_id: hit.food_id,
    food: hit.name,
    unit: hit.unit,
    amount: hit.unit === 'ml' ? 200 : 100,
    per: scale(hit.per_100, 1 / 100),
    orig: null,
    removed: false,
  };
}

/** A row swapped for a picked food: the same amount, the new food's values. */
export const swapped = (r: DraftRow, hit: FoodHit): DraftRow => ({
  ...r,
  food_id: hit.food_id,
  food: hit.name,
  unit: hit.unit,
  per: scale(hit.per_100, 1 / 100),
});

/** Remove: a row added here goes; a saved one is struck through until Save (Put back undoes that). */
export const removed = (d: Draft, id: string): DraftRow[] =>
  d.rows.flatMap((r) => (r.id !== id ? [r] : r.orig ? [{ ...r, removed: true }] : []));

// ---- what a Save sends (the form's fields; src/lib/server/saves.ts makes the door's body) ------------------------------------

const rowFields = (rows: DraftRow[]) => ({ food_id: rows.map((r) => String(r.food_id)), amount: rows.map((r) => String(r.amount)) });

/** Save: a changed meal (usual_meal: its name and the whole list, in order) or a new one (usual_new: name, meal or drink, foods). */
export function saveFields(d: Draft): { action: 'usual_meal' | 'usual_new'; fields: FieldValues } {
  const rows = rowFields(live(d));
  if (d.mode === 'new') return { action: 'usual_new', fields: { name: cleanName(d.name), drink: d.drink ? '1' : '0', ...rows } };
  return { action: 'usual_meal', fields: { meal_id: String(d.meal_id), action: 'save', name: cleanName(d.name), ...rows } };
}

/** Delete (usual_meal with action delete). */
export const deleteFields = (d: Draft): FieldValues => ({ meal_id: String(d.meal_id), action: 'delete' });

// ---- the search (GET /foods?q= through /library/usual/foods here) ---------------------------------------------------------------

/** Where the browser asks for foods: this app's own route, which asks the door. */
export const searchUrl = (q: string) => `/library/usual/foods?q=${encodeURIComponent(q.trim().slice(0, 100))}`;

/** "380 kcal · 13 g protein per 100 g". */
export const perText = (h: FoodHit) => `${n(h.per_100.kcal)} kcal · ${n(h.per_100.protein)} g protein per 100 ${h.unit}`;

/**
 * Typing in the search field: each word asks again, and only the newest answer counts (an older one that comes back later is
 * dropped, as the saves'). find() resolves to the foods, or null when a newer search was started meanwhile.
 */
export class FoodSearch {
  #seq = 0;
  constructor(private readonly ask: (q: string) => Promise<FoodHit[]>) {}

  async find(q: string): Promise<FoodHit[] | null> {
    const seq = ++this.#seq;
    let hits: FoodHit[];
    try {
      hits = await this.ask(q);
    } catch {
      hits = [];
    }
    return seq === this.#seq ? hits : null;
  }

  /** The search was closed: any answer still on its way is dropped. */
  stop() {
    this.#seq++;
  }
}
