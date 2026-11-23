// Every value on the Food day (web 73): the columns of each mode, how numbers are written, unknown values, the meal and day totals
// against the daily budget, the six extra tiles and an open row's every value.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { foodBlocks, type FoodDay, type FoodEntry } from './food.js';
import {
  against,
  anyUnknown,
  columnsOf,
  COLUMNS,
  dayCard,
  dayRows,
  everyValue,
  extraTiles,
  fmt,
  GRID,
  mealCells,
  mealMacros,
  modeOf,
  short,
  sumCell,
  tableNum,
  totalLabel,
  valueCell,
} from './foodvalues.js';
import type { NutrientLine } from './nutrients.js';

/** The door's answers (tests/samples/food.json: an invented day; its web 73 fields were added by hand with made-up values). */
const SAMPLE = JSON.parse(readFileSync(new URL('../../tests/samples/food.json', import.meta.url), 'utf8'));
const TODAY: FoodDay = SAMPLE.food_day.food_day;
const ENTRY: FoodEntry = SAMPLE.entry.entry;
const copy = (): FoodDay => structuredClone(TODAY);
const line = (fd: FoodDay, key: string) => fd.lines.find((l) => l.key === key)!;

describe('the switch and its columns', () => {
  it('shows All values unless Macros was chosen on the device', () => {
    expect(modeOf(null)).toBe('all');
    expect(modeOf('macros')).toBe('macros');
    expect(modeOf('anything')).toBe('all');
  });

  it('has the ten values in the table’s order, the four macros in Macros', () => {
    expect(COLUMNS.map((c) => c.head)).toEqual(['kcal', 'Prot. g', 'Fat g', 'Sat. g', 'Carbs g', 'Sugar g', 'Added g', 'Fibre g', 'Salt g', 'Caff. mg']);
    expect(columnsOf('macros').map((c) => c.macroHead)).toEqual(['kcal', 'Protein', 'Fat', 'Carbs']);
    expect(GRID.map((c) => c.grid)).toEqual(['Protein', 'Fat', 'Sat. fat', 'Carbs', 'Sugar', 'Added', 'Fibre', 'Salt', 'Caffeine']);
    expect(COLUMNS.filter((c) => c.quiet).map((c) => c.key)).toEqual(['sat_fat', 'sugar_total']);
  });
});

describe('numbers', () => {
  it('writes salt with 2 decimals, kcal and caffeine whole, the rest with 1, zero as 0', () => {
    expect(fmt('salt', 0.255)).toBe('0.26');
    expect(fmt('caffeine_mg', 94.5)).toBe('94'); // half to even, as Python
    expect(fmt('kcal', 1399.5)).toBe('1,400');
    expect(fmt('fibre', 5.6)).toBe('5.6');
    expect(fmt('fibre', 28)).toBe('28.0');
    expect(fmt('sugar_added', 0)).toBe('0');
    expect(fmt('sugar_added', 0.04)).toBe('0');
    expect(fmt('salt', 0.004)).toBe('0');
  });

  it('keeps the PC table’s kcal, protein, fat and carbs whole', () => {
    expect(tableNum('protein', 57.2)).toBe('57');
    expect(tableNum('carbs', 136.4)).toBe('136');
    expect(tableNum('sat_fat', 12.3)).toBe('12.3');
    expect(tableNum('salt', 1)).toBe('1.00');
  });

  it('drops trailing zeros in words (the tiles)', () => {
    expect(short('fibre', 28)).toBe('28');
    expect(short('salt', 1.2)).toBe('1.2');
    expect(short('salt', 0.25)).toBe('0.25');
    expect(short('kcal', 2100)).toBe('2,100');
  });
});

describe('a food’s value and a sum', () => {
  it('shows an unknown value as ? in amber, never as zero', () => {
    expect(valueCell('sugar_added', null)).toEqual({ text: '?', tone: 'amber', grams: false });
    expect(valueCell('sugar_added', 0)).toEqual({ text: '0', tone: 'text', grams: false });
  });

  it('mutes the “of which” values in the table, not on the phone', () => {
    expect(valueCell('sat_fat', 2.9).tone).toBe('muted');
    expect(valueCell('sat_fat', 2.9, 'card').tone).toBe('text');
    expect(valueCell('protein', 18)).toEqual({ text: '18', tone: 'text', grams: true });
    expect(valueCell('protein', 18.4, 'card').text).toBe('18.4');
  });

  it('marks a sum that leaves foods without a value out with ≥ in amber', () => {
    expect(sumCell('sugar_added', 6.5, 1)).toEqual({ text: '≥ 6.5', tone: 'amber', grams: false });
    expect(sumCell('protein', 36.7, 0)).toEqual({ text: '37', tone: 'text', grams: true });
    expect(sumCell('protein', 36.7, 0, 'card').text).toBe('36.7');
  });
});

describe('against the daily budget', () => {
  const l = (key: NutrientLine['key'], value: number, target: number | null, unknown = 0) => ({ key, value, target, unknown });

  it('gives the difference with a real minus sign and in percent of the budget', () => {
    const a = against(l('kcal', 1667, 2100));
    expect(a.budget).toMatchObject({ text: '2,100', tone: 'muted' });
    expect(a.diff).toMatchObject({ text: '−433', tone: 'text' });
    expect(a.pct.text).toBe('−21%');
    const over = against(l('fat', 82, 70));
    expect([over.diff.text, over.pct.text]).toEqual(['+12', '+17%']);
  });

  it('says 0 when the difference rounds to nothing', () => {
    expect(against(l('protein', 150.3, 150)).diff.text).toBe('0');
    expect(against(l('protein', 150.3, 150)).pct.text).toBe('0%');
    expect(against(l('salt', 6.004, 6)).diff.text).toBe('0');
  });

  it('marks both with ≥ in amber when entries have no value', () => {
    const a = against(l('fibre', 13.2, 30, 2), 'card');
    expect(a.diff).toMatchObject({ text: '≥ −16.8', tone: 'amber' });
    expect(a.pct).toMatchObject({ text: '≥ −56%', tone: 'amber' });
    expect(against(l('sugar_added', 8.2, 25, 1), 'card').pct.text).toBe('≥ −67%');
  });

  it('shows – where no budget is set', () => {
    const a = against(l('caffeine_mg', 127, null));
    expect([a.budget.text, a.diff.text, a.pct.text]).toEqual(['–', '–', '–']);
    expect(a.diff.tone).toBe('muted');
  });

  it('writes a budget whole when it is, else with the value’s decimals', () => {
    expect(against(l('salt', 4, 6)).budget.text).toBe('6');
    expect(against(l('salt', 4, 5.5)).budget.text).toBe('5.5');
  });
});

describe('the day’s closing rows and card', () => {
  it('has Day total, Daily budget, Difference and Difference in % over every column', () => {
    const rows = dayRows(TODAY);
    expect(rows.map((r) => r.label)).toEqual(['Day total', 'Daily budget', 'Difference', 'Difference in %']);
    expect(Object.keys(rows[0]!.cells)).toEqual(COLUMNS.map((c) => c.key));
    // 1399.5 kcal against 2,100: −700.5, half to even
    expect(rows.map((r) => r.cells.kcal!.text)).toEqual(['1,400', '2,100', '−700', '−33%']);
    // added sugar: the apple has no value
    expect(rows.map((r) => r.cells.sugar_added!.text)).toEqual(['≥ 6.5', '25', '≥ −18.5', '≥ −74%']);
    // saturated fat: no budget
    expect(rows.map((r) => r.cells.sat_fat!.text)).toEqual(['12.3', '–', '–', '–']);
    expect(rows.map((r) => r.cells.fibre!.text)).toEqual(['33.4', '30', '+3.4', '+11%']);
  });

  it('has a row per value on the phone, the percent under the difference, one decimal for the macros', () => {
    const card = dayCard(TODAY);
    expect(card.map((r) => r.name)).toEqual(['Calories', 'Protein', 'Fat', 'Saturated', 'Carbs', 'Sugar', 'Added sugar', 'Fibre', 'Salt', 'Caffeine']);
    const protein = card.find((r) => r.key === 'protein')!;
    expect([protein.total.text, protein.budget.text, protein.diff.text, protein.pct?.text]).toEqual(['57.2', '150', '−92.8', '−62%']);
    const caffeine = card.find((r) => r.key === 'caffeine_mg')!;
    expect([caffeine.total.text, caffeine.budget.text, caffeine.diff.text, caffeine.pct]).toEqual(['80', '–', '–', null]);
    expect(card.filter((r) => r.macro).map((r) => r.key)).toEqual(['kcal', 'protein', 'fat', 'carbs']);
  });

  it('knows whether a mode shows anything not known', () => {
    expect(anyUnknown(TODAY, 'all')).toBe(true);
    expect(anyUnknown(TODAY, 'macros')).toBe(false);
  });

  it('reads a day without lines as nothing eaten and no budget', () => {
    const rows = dayRows({ lines: [] });
    expect(rows.map((r) => r.cells.kcal!.text)).toEqual(['0', '–', '–', '–']);
  });
});

describe('a meal’s total', () => {
  it('comes with each meal’s block: its sums, with ≥ where an entry has no value', () => {
    const b = foodBlocks(TODAY);
    const lunch = b.find((x) => x.meal === 2)!;
    expect(totalLabel(lunch.label)).toBe('Meal 2 total');
    expect(totalLabel('Drinks')).toBe('Drinks total');
    const cells = mealCells(lunch.values!, lunch.unknown!, 'table');
    expect([cells.kcal.text, cells.protein.text, cells.sugar_added.text, cells.salt.text]).toEqual(['934', '37', '≥ 6.5', '≥ 3.67']);
    expect(cells.sugar_added.tone).toBe('amber');
    expect(mealCells(lunch.values!, lunch.unknown!, 'card').protein.text).toBe('36.7');
  });

  it('is one line in Macros on the phone', () => {
    const lunch = foodBlocks(TODAY).find((x) => x.meal === 2)!;
    expect(mealMacros(lunch.values!, lunch.unknown!)).toBe('P 37 g · F 29 g · C 136 g');
    expect(mealMacros(lunch.values!, { ...lunch.unknown!, fat: 1 })).toBe('P 37 g · F ≥ 29 g · C 136 g');
  });

  it('has no sums when the door sent none for the meal', () => {
    const d = copy();
    d.meals = [];
    expect(foodBlocks(d)[0]!.values).toBeNull();
  });
});

describe('the six extra tiles', () => {
  it('says the gap in words, no target, or how many foods have no value', () => {
    const t = extraTiles(TODAY);
    expect(t.map((x) => x.name)).toEqual(['Saturated fat', 'Sugar', 'Added sugar', 'Fibre', 'Salt', 'Caffeine']);
    const by = Object.fromEntries(t.map((x) => [x.key, x]));
    expect(by.sat_fat).toMatchObject({ value: '12.3 g', target: '', pct: null, note: 'no target', atLeast: false, warn: false });
    expect(by.sugar_added).toMatchObject({ value: '6.5 g', target: '/ 25 g', note: '1 food without a value', atLeast: true, warn: true });
    expect(by.fibre).toMatchObject({ value: '33.4 g', target: '/ 30 g', note: '3.4 g over', pct: 100 });
    expect(by.caffeine_mg).toMatchObject({ value: '80 mg', note: 'no target' });
  });

  it('says what is left or to go when all is known', () => {
    const d = copy();
    Object.assign(line(d, 'fibre'), { value: 24.4 });
    Object.assign(line(d, 'salt'), { value: 4.22, unknown: 0, unknown_foods: 0 });
    Object.assign(line(d, 'sugar_added'), { value: 31, unknown: 0, unknown_foods: 0 });
    const by = Object.fromEntries(extraTiles(d).map((x) => [x.key, x]));
    expect(by.fibre!.note).toBe('5.6 g to go');
    expect(by.salt!.note).toBe('1.78 g left');
    expect(by.sugar_added!.note).toBe('6 g over');
    Object.assign(line(d, 'sugar_added'), { value: 0, unknown: 2, unknown_foods: 2 });
    expect(extraTiles(d).find((x) => x.key === 'sugar_added')!.note).toBe('2 foods without a value');
  });
});

describe('an open row’s every value (phone)', () => {
  it('lists the ten values as eaten and per 100, unknown where there is none', () => {
    const apple = TODAY.rows.find((r) => r.food === 'Apple with peanut butter')!;
    const rows = everyValue(apple.values, null);
    expect(rows.map((r) => r.label)).toEqual(['Calories', 'Protein', 'Fat', 'of which saturated', 'Carbs', 'of which sugar', 'Added sugar', 'Fibre', 'Salt', 'Caffeine']);
    expect(rows.find((r) => r.key === 'sugar_added')).toMatchObject({ eaten: 'unknown', unknown: true, per100: '…' });
    expect(rows.find((r) => r.key === 'kcal')!.eaten).toBe('165 kcal');
    expect(everyValue(apple.values, null, true)[0]!.per100).toBe('–');
  });

  it('takes the food’s values per 100 from the entry', () => {
    const bread = TODAY.rows.find((r) => r.ref === ENTRY.ref)!;
    const rows = everyValue(bread.values, ENTRY.per_100);
    expect(rows.find((r) => r.key === 'salt')).toMatchObject({ eaten: '1.00 g', per100: '1.25 g', per100Known: true });
    expect(rows.find((r) => r.key === 'fibre')).toMatchObject({ eaten: '5.6 g', per100: '7.0 g' });
    expect(rows.find((r) => r.key === 'sat_fat')!.sub).toBe(true);
  });
});
