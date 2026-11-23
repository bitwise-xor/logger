/**
 * Every value on the Food day (web 73, 23.11.2026): the "Macros / All values" switch's columns, how each value is written in the
 * PC table, the phone's grids and the Day total card, the six extra tiles, a meal's and the day's totals against the daily budget,
 * and an open row's "Every value" table. Plain TypeScript, so the unit tests need no browser. The numbers come from the door's
 * GET /food/day (rows[].values, meals[].values and .unknown, lines: docs/API.md).
 *
 * Unknown is never shown as zero: a food without a value reads "?" in amber; a sum that leaves such entries out reads "≥ 8.2" in
 * amber (the tiles: "at least 8.2 g" and "2 foods without a value"). Difference = day total minus the daily budget, with a real
 * minus sign; Difference in % = that difference as a share of the budget, a whole number. A value without a budget shows "–".
 */
import { n, pct, roundHalfEven } from './format.js';
import type { FoodDay } from './food.js';
import type { NutrientKey, NutrientLine, Values } from './nutrients.js';

// ---- the switch --------------------------------------------------------------------------------------------------------------

/** "all": every tracked value (shown at first); "macros": the four macros, as the Day tab was. */
export type ValuesMode = 'all' | 'macros';

/** The stored choice (localStorage, foodmode.svelte.ts) as the switch reads it: "macros" only when that was chosen, else All values. */
export const modeOf = (stored: string | null): ValuesMode => (stored === 'macros' ? 'macros' : 'all');

// ---- the ten values ----------------------------------------------------------------------------------------------------------

export interface Column {
  key: NutrientKey;
  /** The PC table's header in All values ("Prot. g"), and in Macros ("Protein"; null: not shown in Macros). */
  head: string;
  macroHead: string | null;
  /** The phone's three-by-three grid ("Sat. fat"). */
  grid: string;
  /** The Day total card's row ("Saturated"). */
  name: string;
  unit: string;
  /** An "of which" value (saturated fat, sugar): muted in the PC table's food rows, indented in the cards. */
  quiet: boolean;
  /** One of the four macros (kcal, protein, fat, carbs): shown in Macros too, and whole numbers in the PC table. */
  macro: boolean;
}

const c = (key: NutrientKey, head: string, macroHead: string | null, grid: string, name: string, unit: string, quiet = false): Column => ({
  key,
  head,
  macroHead,
  grid,
  name,
  unit,
  quiet,
  macro: macroHead !== null,
});

/** The ten values in the door's order (the Nutrients tab's lines). */
export const COLUMNS: Column[] = [
  c('kcal', 'kcal', 'kcal', 'kcal', 'Calories', 'kcal'),
  c('protein', 'Prot. g', 'Protein', 'Protein', 'Protein', 'g'),
  c('fat', 'Fat g', 'Fat', 'Fat', 'Fat', 'g'),
  c('sat_fat', 'Sat. g', null, 'Sat. fat', 'Saturated', 'g', true),
  c('carbs', 'Carbs g', 'Carbs', 'Carbs', 'Carbs', 'g'),
  c('sugar_total', 'Sugar g', null, 'Sugar', 'Sugar', 'g', true),
  c('sugar_added', 'Added g', null, 'Added', 'Added sugar', 'g'),
  c('fibre', 'Fibre g', null, 'Fibre', 'Fibre', 'g'),
  c('salt', 'Salt g', null, 'Salt', 'Salt', 'g'),
  c('caffeine_mg', 'Caff. mg', null, 'Caffeine', 'Caffeine', 'mg'),
];

/** The phone's grid: the nine values after kcal (Protein, Fat, Sat. fat / Carbs, Sugar, Added / Fibre, Salt, Caffeine). */
export const GRID: Column[] = COLUMNS.filter((x) => x.key !== 'kcal');

/** The columns a mode shows. */
export const columnsOf = (mode: ValuesMode): Column[] => (mode === 'all' ? COLUMNS : COLUMNS.filter((x) => x.macro));

// ---- numbers -----------------------------------------------------------------------------------------------------------------

/** Decimals of a value: salt 2, kcal and caffeine whole, the rest 1. */
export const digits = (key: NutrientKey) => (key === 'salt' ? 2 : key === 'kcal' || key === 'caffeine_mg' ? 0 : 1);

/** A value as the cards and the phone write it: salt "0.25", caffeine "95", kcal "1,400", the rest "5.6"; "0" when it rounds to nothing. */
export function fmt(key: NutrientKey, x: number): string {
  const d = digits(key);
  return roundHalfEven(x, d) === 0 ? '0' : n(x, d);
}

/** The PC table's number: kcal, protein, fat and carbs whole (as the table was), the others as fmt. */
export function tableNum(key: NutrientKey, x: number): string {
  if (key === 'kcal' || key === 'protein' || key === 'fat' || key === 'carbs') return n(x);
  return fmt(key, x);
}

/** A number in words (the tiles): fmt without trailing zeros ("28 g left", "5.6 g", "1.2 g"). */
export function short(key: NutrientKey, x: number): string {
  const t = fmt(key, x);
  return t.includes('.') ? t.replace(/\.?0+$/, '') : t;
}

/** A budget as written ("2,100", "6", "5.5"): whole when it is, else with the value's decimals. */
export const budgetText = (key: NutrientKey, t: number) => (Number.isInteger(t) ? n(t) : short(key, t));

// ---- cells -------------------------------------------------------------------------------------------------------------------

/** "text" the ink, "muted" an "of which" value or no budget, "amber" a value that is not known (or a sum that leaves some out). */
export type Tone = 'text' | 'muted' | 'amber';

export interface Cell {
  text: string;
  tone: Tone;
  /** In the PC table's Macros mode, kcal aside, a number carries " g" (the header has no unit there); never after "?" or "≥". */
  grams: boolean;
}

/** Where a number is written: the PC table (whole macros) or a phone card (fmt). */
export type Place = 'table' | 'card';

const number = (key: NutrientKey, x: number, place: Place) => (place === 'table' ? tableNum(key, x) : fmt(key, x));
const gramsOf = (key: NutrientKey) => key === 'protein' || key === 'fat' || key === 'carbs';

/** A food's value: "?" in amber when the food has none; "of which" values muted in the PC table. */
export function valueCell(key: NutrientKey, v: number | null | undefined, place: Place = 'table'): Cell {
  if (v === null || v === undefined) return { text: '?', tone: 'amber', grams: false };
  const quiet = place === 'table' && COLUMNS.find((x) => x.key === key)!.quiet;
  return { text: number(key, v, place), tone: quiet ? 'muted' : 'text', grams: gramsOf(key) };
}

/** A sum (a meal's, the day's): "≥ 8.2" in amber when entries without a value were left out. */
export function sumCell(key: NutrientKey, v: number | null | undefined, unknown: number, place: Place = 'table'): Cell {
  const t = number(key, v ?? 0, place);
  return unknown > 0 ? { text: `≥ ${t}`, tone: 'amber', grams: false } : { text: t, tone: 'text', grams: gramsOf(key) };
}

/** A signed amount with a real minus sign: "−433", "+12", "0" when it rounds to nothing. */
export function signed(text: string, d: number): string {
  if (text === '0') return '0';
  return `${d < 0 ? '−' : '+'}${text}`;
}

export interface Against {
  /** "2,100", or "–" without a budget (muted). */
  budget: Cell;
  /** "−433", "≥ −16.8" (amber), or "–" (muted). */
  diff: Cell;
  /** "−21%", "≥ −67%" (amber), or "–" (muted). */
  pct: Cell;
}

const DASH: Cell = { text: '–', tone: 'muted', grams: false };

/** A day's line against its daily budget (the line's target): the budget, the difference and the difference in percent. */
export function against(l: Pick<NutrientLine, 'key' | 'value' | 'unknown' | 'target'>, place: Place = 'table'): Against {
  const t = l.target;
  if (!t) return { budget: DASH, diff: DASH, pct: DASH };
  const d = l.value - t;
  const body = number(l.key, Math.abs(d), place);
  const p = roundHalfEven((Math.abs(d) / t) * 100);
  const pctText = `${p === 0 ? '0' : `${d < 0 ? '−' : '+'}${p}`}%`;
  const unknown = l.unknown > 0;
  return {
    budget: { text: budgetText(l.key, t), tone: 'muted', grams: gramsOf(l.key) },
    diff: unknown ? { text: `≥ ${signed(body, d)}`, tone: 'amber', grams: false } : { text: signed(body, d), tone: 'text', grams: gramsOf(l.key) },
    pct: unknown ? { text: `≥ ${pctText}`, tone: 'amber', grams: false } : { text: pctText, tone: 'text', grams: false },
  };
}

// ---- the day's closing rows and card -----------------------------------------------------------------------------------------

export interface DayRow {
  label: 'Day total' | 'Daily budget' | 'Difference' | 'Difference in %';
  cells: Partial<Record<NutrientKey, Cell>>;
}

/** The line of each key (the door sends all ten; one missing reads as nothing eaten, no budget). */
export function lineOf(fd: Pick<FoodDay, 'lines'>, key: NutrientKey): NutrientLine {
  const l = fd.lines.find((x) => x.key === key);
  const col = COLUMNS.find((x) => x.key === key)!;
  return l ?? { key, label: col.name, unit: col.unit, sub: col.quiet, aim: null, sum: 0, value: 0, unknown: 0, unknown_foods: 0, target: null };
}

/** The PC table's four closing rows over every column: Day total, Daily budget, Difference, Difference in %. */
export function dayRows(fd: Pick<FoodDay, 'lines'>): DayRow[] {
  const rows: DayRow[] = [
    { label: 'Day total', cells: {} },
    { label: 'Daily budget', cells: {} },
    { label: 'Difference', cells: {} },
    { label: 'Difference in %', cells: {} },
  ];
  for (const col of COLUMNS) {
    const l = lineOf(fd, col.key);
    const a = against(l, 'table');
    rows[0]!.cells[col.key] = sumCell(col.key, l.value, l.unknown, 'table');
    rows[1]!.cells[col.key] = a.budget;
    rows[2]!.cells[col.key] = a.diff;
    rows[3]!.cells[col.key] = a.pct;
  }
  return rows;
}

export interface DayCardRow {
  key: NutrientKey;
  name: string;
  unit: string;
  quiet: boolean;
  macro: boolean;
  total: Cell;
  budget: Cell;
  diff: Cell;
  /** Under the difference; null without a budget. */
  pct: Cell | null;
}

/** The phone's Day total card: one row per value (the four macros in Macros mode), with the percent under the difference. */
export function dayCard(fd: Pick<FoodDay, 'lines'>): DayCardRow[] {
  return COLUMNS.map((col) => {
    const l = lineOf(fd, col.key);
    const a = against(l, 'card');
    return {
      key: col.key,
      name: col.name,
      unit: col.unit,
      quiet: col.quiet,
      macro: col.macro,
      total: sumCell(col.key, l.value, l.unknown, 'card'),
      budget: a.budget,
      diff: a.diff,
      pct: l.target ? a.pct : null,
    };
  });
}

/** Whether anything shown is not known (the line under the totals then explains "?" and "≥"). */
export const anyUnknown = (fd: Pick<FoodDay, 'lines'>, mode: ValuesMode) => columnsOf(mode).some((col) => lineOf(fd, col.key).unknown > 0);

// ---- a meal's total ----------------------------------------------------------------------------------------------------------

/** A meal's (or the drinks') sums: one cell per value, "≥" where entries without a value were left out. */
export function mealCells(values: Values, unknown: Partial<Record<NutrientKey, number>>, place: Place): Record<NutrientKey, Cell> {
  return Object.fromEntries(COLUMNS.map((col) => [col.key, sumCell(col.key, values[col.key], unknown[col.key] ?? 0, place)])) as Record<NutrientKey, Cell>;
}

/** The phone's meal card in Macros mode: "P 26 g · F 17 g · C 51 g" ("P ≥ 26 g" when an entry has no value). */
export function mealMacros(values: Values, unknown: Partial<Record<NutrientKey, number>>): string {
  const one = (k: 'protein' | 'fat' | 'carbs', letter: string) => `${letter} ${unknown[k] ? '≥ ' : ''}${n(values[k] ?? 0)} g`;
  return `${one('protein', 'P')} · ${one('fat', 'F')} · ${one('carbs', 'C')}`;
}

/** A meal's label for its total row: "Meal 3 total", "Drinks total". */
export const totalLabel = (label: string) => `${label} total`;

// ---- the six extra tiles -----------------------------------------------------------------------------------------------------

export interface ExtraTile {
  key: NutrientKey;
  name: string;
  /** "5.6 g", "95 mg". */
  value: string;
  /** "at least" stands before the value: foods without a value were left out. */
  atLeast: boolean;
  /** "/ 30 g", or "" without a target. */
  target: string;
  /** The bar's fill; null: no bar (no target). */
  pct: number | null;
  /** "5.6 g to go", "28 g left", "6 g over", "no target", or "2 foods without a value". */
  note: string;
  /** The note in amber (foods without a value). */
  warn: boolean;
}

const EXTRA: { key: NutrientKey; name: string; under: string }[] = [
  { key: 'sat_fat', name: 'Saturated fat', under: 'left' },
  { key: 'sugar_total', name: 'Sugar', under: 'left' },
  { key: 'sugar_added', name: 'Added sugar', under: 'left' },
  { key: 'fibre', name: 'Fibre', under: 'to go' },
  { key: 'salt', name: 'Salt', under: 'left' },
  { key: 'caffeine_mg', name: 'Caffeine', under: 'left' },
];

/**
 * The six tiles under the four (All values): each value against its target as the four tiles say it ("28 g left", "6 g over": over
 * is said in words, not a colour); a total that leaves foods out reads "at least" and says how many foods have no value, in amber.
 */
export function extraTiles(fd: Pick<FoodDay, 'lines'>): ExtraTile[] {
  return EXTRA.map(({ key, name, under }) => {
    const l = lineOf(fd, key);
    const col = COLUMNS.find((x) => x.key === key)!;
    const value = `${short(key, l.value)} ${col.unit}`;
    const t = l.target;
    let note = 'no target';
    if (l.unknown_foods > 0) note = `${l.unknown_foods} ${l.unknown_foods === 1 ? 'food' : 'foods'} without a value`;
    else if (t) {
      const gap = t - l.value;
      note = gap >= 0 ? `${short(key, gap)} ${col.unit} ${under}` : `${short(key, -gap)} ${col.unit} over`;
    }
    return {
      key,
      name,
      value,
      atLeast: l.unknown_foods > 0 || l.unknown > 0,
      target: t ? `/ ${budgetText(key, t)} ${col.unit}` : '',
      pct: t ? pct(l.value, t) : null,
      note,
      warn: l.unknown_foods > 0 || l.unknown > 0,
    };
  });
}

// ---- an open row's every value (phone) ---------------------------------------------------------------------------------------

export interface EveryValueRow {
  key: NutrientKey;
  /** The Nutrients tab's words: "Calories", "of which saturated", … */
  label: string;
  sub: boolean;
  /** "14.7 g", or "unknown". */
  eaten: string;
  /** Per 100 g or ml, "unknown", "…" while the entry is on its way, "–" when it could not be read. */
  per100: string;
  /** No value as eaten. */
  unknown: boolean;
  per100Known: boolean;
}

const LABEL: Record<NutrientKey, string> = {
  kcal: 'Calories',
  protein: 'Protein',
  fat: 'Fat',
  sat_fat: 'of which saturated',
  carbs: 'Carbs',
  sugar_total: 'of which sugar',
  sugar_added: 'Added sugar',
  fibre: 'Fibre',
  salt: 'Salt',
  caffeine_mg: 'Caffeine',
};

/** A food row's ten values as eaten and per 100 g or ml (per_100 null: not read yet, or `failed`), "unknown" where there is none. */
export function everyValue(values: Values, per100: Values | null, failed = false): EveryValueRow[] {
  const known = (v: number | null | undefined): v is number => v !== null && v !== undefined;
  const show = (key: NutrientKey, unit: string, v: number | null | undefined) => (known(v) ? `${fmt(key, v)} ${unit}` : 'unknown');
  return COLUMNS.map((col) => ({
    key: col.key,
    label: LABEL[col.key],
    sub: col.quiet,
    eaten: show(col.key, col.unit, values[col.key]),
    per100: per100 ? show(col.key, col.unit, per100[col.key]) : failed ? '–' : '…',
    unknown: !known(values[col.key]),
    per100Known: !!per100 && known(per100[col.key]),
  }));
}
