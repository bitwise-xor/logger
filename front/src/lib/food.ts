/**
 * The Food day (step E, deploy 84) as the door sends it (GET /api/v1/food/day and /food/entry, docs/API.md) and what the page
 * makes of it: the four total tiles, the rows by meal, the day switch, and what a changed amount becomes. Plain TypeScript, so
 * the unit tests need no browser. front/tests/samples/food.json is a real answer of the door.
 */
import { mealLabel, newestFirst, type Nutrients, type RowBlock, type Targets } from './day.js';
import { hm, n, pct } from './format.js';

// ---- the door's shapes -------------------------------------------------------------------------------------------------------

/** A row of the Food day: a food row of Today with its note (and no usual meal). */
export interface FoodDayRow {
  ref: string;
  kind: 'food';
  meal: number;
  at: string | null;
  time_known: boolean;
  food: string;
  food_id: number;
  amount: number;
  /** The food's own unit (g or ml): the amount is in it. */
  unit: string;
  portion_text: string | null;
  nutrients: Nutrients;
  note: string | null;
}

export interface FoodDay {
  day: string;
  today: string;
  past: boolean;
  rows: FoodDayRow[];
  /** `note` (21.11.2026): the meal's one-line note, or null (the drinks never have one). */
  meals: { meal: number; label: string; nutrients: Nutrients; note: string | null }[];
  totals: Nutrients;
  targets: Targets;
  /** A meal note whose meals are all gone: shown as a note on the day; else null. */
  day_note: string | null;
}

/** One entry with the units its amount can be given in: the food's own first (in_basis 1), then its others ("slice", 35). */
export interface FoodEntry {
  ref: string;
  day: string;
  food_id: number;
  food: string;
  amount: number;
  unit: string;
  at: string | null;
  time_known: boolean;
  note: string | null;
  units: { unit: string; in_basis: number }[];
}

// ---- the four tiles ----------------------------------------------------------------------------------------------------------

export interface Tile {
  key: keyof Nutrients;
  name: string;
  value: string;
  /** "2,100 kcal", or "" without a target. */
  target: string;
  pct: number;
  /** "733 kcal left", "74 g to go", "12 g over", "no target". */
  left: string;
}

const TILES: { key: keyof Nutrients; name: string; unit: string; under: string }[] = [
  { key: 'kcal', name: 'Calories', unit: 'kcal', under: 'left' },
  { key: 'protein', name: 'Protein', unit: 'g', under: 'to go' },
  { key: 'fat', name: 'Fat', unit: 'g', under: 'left' },
  { key: 'carbs', name: 'Carbs', unit: 'g', under: 'left' },
];

/** The day's totals against the targets (the mockup's tiles); being over a target is said plainly, not in a colour. */
export function tiles(fd: FoodDay): Tile[] {
  return TILES.map(({ key, name, unit, under }) => {
    const value = fd.totals[key] ?? 0;
    const target = fd.targets[key];
    if (!target) return { key, name, value: n(value), target: '', pct: 0, left: 'no target' };
    const gap = target - value;
    return {
      key,
      name,
      value: n(value),
      target: `${n(target)} ${unit}`,
      pct: pct(value, target),
      left: gap >= 0 ? `${n(gap)} ${unit} ${under}` : `${n(-gap)} ${unit} over`,
    };
  });
}

// ---- the rows by meal --------------------------------------------------------------------------------------------------------

/** An amount as typed: whole numbers with a thousands comma, others with one decimal ("12.5"). */
export const amountText = (x: number) => (Number.isInteger(x) ? n(x) : n(x, 1));

export interface FoodLine {
  ref: string;
  time: string;
  /** "hh:mm" for the time field, "" when the time is not known. */
  clock: string;
  name: string;
  /** "300 g (1 bowl)". */
  amount: string;
  sub: string;
  kcal: string;
  protein: string;
  fat: string;
  carbs: string;
  note: string | null;
  row: FoodDayRow;
}

export interface FoodBlock {
  key: string;
  /** The meal's number: 1, 2, …; 0 is the drinks (which cannot be saved as a usual meal). */
  meal: number;
  label: string;
  total: string;
  /** The meal's note (21.11.2026), or null; the drinks have none. */
  note: string | null;
  lines: FoodLine[];
}

function foodLine(r: FoodDayRow): FoodLine {
  const amount = `${amountText(r.amount)} ${r.unit}${r.portion_text ? ` (${r.portion_text})` : ''}`;
  const time = r.time_known ? hm(r.at) : '';
  return {
    ref: r.ref,
    time,
    clock: time,
    name: r.food,
    amount,
    sub: `${amount} · ${n(r.nutrients.protein)} g protein`,
    kcal: `${n(r.nutrients.kcal)} kcal`,
    protein: `${n(r.nutrients.protein)} g`,
    fat: `${n(r.nutrients.fat)} g`,
    carbs: `${n(r.nutrients.carbs)} g`,
    note: r.note,
    row: r,
  };
}

/** The rows by meal, newest meal first and the drinks last, as on Today (day.ts, newestFirst); each meal with its kcal. */
export function foodBlocks(fd: FoodDay): FoodBlock[] {
  const meals = new Map(fd.meals.map((m) => [m.meal, m]));
  const byMeal = new Map<number, RowBlock<FoodDayRow>>();
  for (const r of fd.rows) {
    let b = byMeal.get(r.meal);
    if (!b) byMeal.set(r.meal, (b = { key: `meal-${r.meal}`, meal: r.meal, rows: [] }));
    b.rows.push(r);
  }
  return newestFirst([...byMeal.values()]).map((b) => {
    const meal = meals.get(b.meal!);
    return {
      key: b.key,
      meal: b.meal!,
      label: mealLabel(b.meal!, meal?.label),
      total: meal ? `${n(meal.nutrients.kcal)} kcal` : '',
      note: meal?.note ?? null,
      lines: b.rows.map(foodLine),
    };
  });
}

// ---- the day switch ----------------------------------------------------------------------------------------------------------

/** A logging day moved by whole days ("2026-11-16", -1 -> "2026-11-15"). */
export function shiftDay(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** The Food day of a day (the Day tab): /food?day=yyyy-mm-dd, or /food plain for today (when today is known). */
export const foodDayHref = (day: string, today?: string) => (day === today ? '/food' : `/food?day=${encodeURIComponent(day)}`);

/** Where ‹ and › lead: the day before always; the day after only from a past day (a later day is today: /food plain). */
export function dayLinks(fd: Pick<FoodDay, 'day' | 'today' | 'past'>): { before: string; after: string | null } {
  const next = shiftDay(fd.day, 1);
  return {
    before: `/food?day=${shiftDay(fd.day, -1)}`,
    after: !fd.past ? null : next >= fd.today ? '/food' : `/food?day=${next}`,
  };
}

/** A meal's note as typed: whitespace collapsed (as the door saves it), at most 300 characters. */
export const mealNoteText = (text: string) => text.split(/\s+/).filter(Boolean).join(' ').slice(0, 300);

/** A day the page may ask the door for: yyyy-mm-dd and a real date, else none (= today). */
export function askedDay(v: string | null): string | undefined {
  if (!v || !/^\d{4}-\d\d-\d\d$/.test(v)) return undefined;
  return shiftDay(v, 0) === v ? v : undefined;
}

// ---- changing a row ----------------------------------------------------------------------------------------------------------

/**
 * A food row the editor opens (components/food/FoodEditor.svelte): the Food day's row, or Today's (deploy 117), which has no note
 * (`note` left out: the editor takes it from the entry, GET /food/entry).
 */
export type EditRow = Pick<FoodDayRow, 'ref' | 'at' | 'time_known' | 'food' | 'amount' | 'unit' | 'nutrients'> & { note?: string | null };

/** An amount as typed ("80", "80,5", " 2.5 "): a number above 0, or null. */
export function parseAmount(text: string): number | null {
  const t = text.trim().replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(t)) return null;
  const x = Number(t);
  return x > 0 ? x : null;
}

/** The − and + buttons: 5 g at a time under 100 g, else 25 g (the mockup); 1 at a time in any other unit (a slice, a cup). */
export function step(amount: number, inBasis: number): number {
  if (inBasis !== 1) return 1;
  return amount < 100 ? 5 : 25;
}

/** − and +: never below one step. */
export function stepped(amount: number, inBasis: number, dir: 1 | -1): number {
  const s = step(amount, inBasis);
  const next = Math.round((amount + dir * s) * 10) / 10;
  return Math.max(s, next);
}

/** What the row's food becomes at a new amount (in the given unit): its nutrients scaled; null when that cannot be worked out. */
export function becomes(r: Pick<FoodDayRow, 'amount' | 'nutrients'>, amount: number | null, inBasis = 1): Nutrients | null {
  if (amount === null || !(r.amount > 0)) return null;
  const k = (amount * inBasis) / r.amount;
  return {
    kcal: r.nutrients.kcal * k,
    protein: r.nutrients.protein * k,
    fat: r.nutrients.fat * k,
    carbs: r.nutrients.carbs * k,
  };
}

/** "468 kcal · 28 g protein", or "–". */
export const becomesText = (x: Nutrients | null) => (x ? `${n(x.kcal)} kcal · ${n(x.protein)} g protein` : '–');

/** The amount in another unit when the unit is switched (80 g -> 2 slice of 40 g), to one decimal. */
export function inUnit(amount: number, fromInBasis: number, toInBasis: number): number {
  return Math.round(((amount * fromInBasis) / toInBasis) * 10) / 10;
}
