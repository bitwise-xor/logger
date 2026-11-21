/**
 * The Food space's Nutrients tab (21.11.2026) as the door sends it (GET /api/v1/food/nutrients, docs/API.md) and what the page makes of
 * it: each line's value against its target, the mark of values that are not known, the foods sorted by their share of a nutrient, and a
 * food's details. Plain TypeScript, so the unit tests need no browser. front/tests/samples/food_space.json is a real answer of the door.
 *
 * An unknown value is never shown as zero without saying so: a total made with entries that have no value reads "at least 31 g", with
 * "2 foods without a value" under it, and a food without a value shows "unknown" where its number would be.
 */
import { dayOf, n, pct } from './format.js';
import { shiftDay } from './food.js';

// ---- the door's shapes -------------------------------------------------------------------------------------------------------

export type NutrientKey = 'kcal' | 'protein' | 'fat' | 'sat_fat' | 'carbs' | 'sugar_total' | 'sugar_added' | 'fibre' | 'salt' | 'caffeine_mg';
export type Values = Record<NutrientKey, number | null> & { sodium_mg: number | null };

export interface NutrientLine {
  key: NutrientKey;
  label: string;
  unit: string;
  /** An "of which" line (saturated under fat, sugar under carbs). */
  sub: boolean;
  /** With a target: "reach" (protein, fibre) or "under" (the rest); null: no aim. */
  aim: 'reach' | 'under' | null;
  /** The period's sum of the known values (the foods' shares are of it). */
  sum: number;
  /** The sum on one day; over 7 or 30 days the average per day with entries. */
  value: number;
  /** Entries, and foods, without a value for this line. */
  unknown: number;
  unknown_foods: number;
  target: number | null;
  sodium_mg?: number | null;
  target_sodium_mg?: number | null;
}

export interface NutrientFood {
  food_id: number;
  ref: string;
  name: string;
  unit: string;
  drink: boolean;
  amount: number;
  entries: number;
  /** Its entries on a one-day period; null over 7 or 30 days. */
  refs: string[] | null;
  values: Values;
  per_100: Values;
  source: string;
}

export interface NutrientMeal {
  meal: number;
  label: string;
  values: Values;
  unknown: Record<NutrientKey, number>;
  foods: string[];
}

export interface Nutrients {
  day: string;
  today: string;
  past: boolean;
  days: number;
  start: string;
  end: string;
  eaten_days: number;
  per_day: boolean;
  nutrients: NutrientLine[];
  foods: NutrientFood[];
  meals: NutrientMeal[];
}

// ---- the page's address ------------------------------------------------------------------------------------------------------

export const PERIODS = [1, 7, 30] as const;
export type Period = (typeof PERIODS)[number];

/** ?days= as the page asks the door: 1, 7 or 30; anything else is 1. */
export const askedPeriod = (v: string | null): Period => (v === '7' ? 7 : v === '30' ? 30 : 1);

/** The tab's address for a day (today: none) and a period (1: none). */
export function nutrientsHref(day: string | null, days: number, today?: string): string {
  const q = new URLSearchParams();
  if (day && day !== today) q.set('day', day);
  if (days !== 1) q.set('days', String(days));
  const s = q.toString();
  return s ? `/food/nutrients?${s}` : '/food/nutrients';
}

/** Where ‹ and › lead: a period earlier or later, keeping the period; › only from a past day (a later day is today). */
export function periodLinks(x: Pick<Nutrients, 'day' | 'today' | 'past' | 'days'>): { before: string; after: string | null } {
  const next = shiftDay(x.day, x.days);
  return {
    before: nutrientsHref(shiftDay(x.day, -x.days), x.days, x.today),
    after: !x.past ? null : nutrientsHref(next >= x.today ? x.today : next, x.days, x.today),
  };
}

/** The switch's words for a period: "15.11. – 21.11." (null for one day: the switch writes the day itself). */
export function periodSpan(x: Pick<Nutrients, 'start' | 'end' | 'per_day'>): string | null {
  return x.per_day ? `${dayOf(x.start).slice(4)} – ${dayOf(x.end).slice(4)}` : null;
}

/** The line under the switch: "Average of 5 days with food" over 7 or 30 days ("No food logged in these 7 days."); none for one day. */
export function periodNote(x: Pick<Nutrients, 'per_day' | 'eaten_days' | 'days'>): string | null {
  if (!x.per_day) return null;
  if (!x.eaten_days) return `No food logged in these ${x.days} days.`;
  return `Average per day of the ${x.eaten_days} ${x.eaten_days === 1 ? 'day' : 'days'} with food (of ${x.days}).`;
}

// ---- numbers -----------------------------------------------------------------------------------------------------------------

/** A value as the tab writes it: kcal and mg whole; grams with one decimal under 10 ("2.7 g", "9 g", "38 g"); salt with two under 1. */
export function amount(key: NutrientKey | 'sodium_mg', v: number | null | undefined): string {
  if (v === null || v === undefined) return '–';
  if (key === 'kcal' || key === 'caffeine_mg' || key === 'sodium_mg') return n(v);
  if (key === 'salt') return n(v, Math.abs(v) < 1 ? 2 : 1);
  return n(v, Math.abs(v) < 10 && !Number.isInteger(v) ? 1 : 0);
}

/** "38 g", "95 mg", "381 kcal", "–". */
export const withUnit = (key: NutrientKey, unit: string, v: number | null | undefined) => (v === null || v === undefined ? '–' : `${amount(key, v)} ${unit}`);

export interface LineView {
  key: NutrientKey;
  label: string;
  sub: boolean;
  /** "38 g", or "at least 38 g" when entries have no value. */
  value: string;
  /** "2 foods without a value", or null. */
  unknown: string | null;
  /** "/ 25 g", or "" without a target. */
  target: string;
  /** The bar's fill (0 without a target). */
  pct: number;
  /** "12 g left", "3 g over", "74 g to go", "reached", or "" without a target. */
  gap: string;
  aim: 'reach' | 'under' | null;
  /** Salt: "860 mg sodium". */
  extra: string | null;
}

/** A line as the card shows it. Being over a target is said in words, not in a colour (as the Food day's tiles). */
export function lineView(l: NutrientLine): LineView {
  const v = withUnit(l.key, l.unit, l.value);
  const unknown = l.unknown_foods ? `${l.unknown_foods} ${l.unknown_foods === 1 ? 'food' : 'foods'} without a value` : null;
  let gap = '';
  if (l.target) {
    const d = l.target - l.value;
    if (l.aim === 'reach') gap = d > 0 ? `${withUnit(l.key, l.unit, d)} to go` : 'reached';
    else gap = d >= 0 ? `${withUnit(l.key, l.unit, d)} left` : `${withUnit(l.key, l.unit, -d)} over`;
  }
  return {
    key: l.key,
    label: l.label,
    sub: l.sub,
    value: unknown ? `at least ${v}` : v,
    unknown,
    target: l.target ? `/ ${withUnit(l.key, l.unit, l.target)}` : '',
    pct: pct(l.value, l.target),
    gap,
    aim: l.target ? l.aim : null,
    extra: l.key === 'salt' && l.sodium_mg !== null && l.sodium_mg !== undefined ? `${n(l.sodium_mg)} mg sodium` : null,
  };
}

// ---- the foods ---------------------------------------------------------------------------------------------------------------

/** "300 g", "2 × 250 ml" (two entries), "1,250 g over 9 entries". */
export function foodAmount(f: Pick<NutrientFood, 'amount' | 'unit' | 'entries'>): string {
  const a = `${n(f.amount, Number.isInteger(f.amount) ? 0 : 1)} ${f.unit}`;
  return f.entries > 1 ? `${a} · ${f.entries} times` : a;
}

/** The food's short line: "420 kcal · P 18 · F 9 · C 66". */
export function foodLine(v: Values): string {
  return `${amount('kcal', v.kcal)} kcal · P ${amount('protein', v.protein)} · F ${amount('fat', v.fat)} · C ${amount('carbs', v.carbs)}`;
}

export interface FoodShare {
  food: NutrientFood;
  /** The food's value of the nutrient sorted by (null: not known). */
  value: number | null;
  /** Its share of the period's sum, 0 to 100 (0 when not known or the sum is 0). */
  share: number;
  /** "Sugar 14 g · 38%", or "Sugar unknown". */
  text: string;
}

/**
 * The foods by their share of one nutrient, largest first (the foods with no value for it last, by name), each with its share of the
 * period's sum; without a nutrient the door's order (most kcal first).
 */
export function foodsBy(x: Pick<Nutrients, 'foods' | 'nutrients'>, key: NutrientKey | null): FoodShare[] {
  const line = key ? x.nutrients.find((l) => l.key === key) : undefined;
  if (!key || !line) return x.foods.map((food) => ({ food, value: null, share: 0, text: '' }));
  const name = line.label.replace(/^of which /, '');
  const label = name.charAt(0).toUpperCase() + name.slice(1);
  const rows = x.foods.map((food) => {
    const value = food.values[key];
    const share = value !== null && line.sum > 0 ? (value / line.sum) * 100 : 0;
    const text = value === null ? `${label} unknown` : `${label} ${withUnit(key, line.unit, value)} · ${n(share)}%`;
    return { food, value, share, text };
  });
  return rows.sort(
    (a, b) => Number(a.value === null) - Number(b.value === null) || (b.value ?? 0) - (a.value ?? 0) || a.food.name.localeCompare(b.food.name),
  );
}

export interface DetailRow {
  key: NutrientKey | 'sodium_mg';
  label: string;
  /** For the amount eaten ("14.7 g"), or "unknown". */
  eaten: string;
  /** Per 100 g or ml, or "unknown". */
  per100: string;
  sub: boolean;
}

/** A food's every value for the amount eaten and per 100 g or ml (sodium beside salt); "unknown" where there is none. */
export function details(f: NutrientFood, lines: NutrientLine[]): DetailRow[] {
  const show = (key: NutrientKey | 'sodium_mg', unit: string, v: number | null) => (v === null || v === undefined ? 'unknown' : `${amount(key, v)} ${unit}`);
  const out: DetailRow[] = [];
  for (const l of lines) {
    out.push({ key: l.key, label: l.label, eaten: show(l.key, l.unit, f.values[l.key]), per100: show(l.key, l.unit, f.per_100[l.key]), sub: l.sub });
    if (l.key === 'salt') out.push({ key: 'sodium_mg', label: 'sodium', eaten: show('sodium_mg', 'mg', f.values.sodium_mg), per100: show('sodium_mg', 'mg', f.per_100.sodium_mg), sub: true });
  }
  return out;
}

/** Library > Foods with this food open. */
export const libraryHref = (f: Pick<NutrientFood, 'ref'>) => `/library?food=${encodeURIComponent(f.ref)}`;

// ---- by meal (one day) -------------------------------------------------------------------------------------------------------

/** Each meal's value of the nutrient (kcal without one) and its share of the day, with "at least" where entries have none. */
export function mealsBy(x: Pick<Nutrients, 'meals' | 'nutrients'>, key: NutrientKey | null): { meal: number; label: string; text: string; share: number }[] {
  const k = key ?? 'kcal';
  const line = x.nutrients.find((l) => l.key === k);
  if (!line) return [];
  return x.meals.map((m) => {
    const v = m.values[k] ?? 0;
    const share = line.sum > 0 ? (v / line.sum) * 100 : 0;
    const known = withUnit(k, line.unit, v);
    return { meal: m.meal, label: m.label, text: `${m.unknown[k] ? `at least ${known}` : known} · ${n(share)}%`, share };
  });
}
