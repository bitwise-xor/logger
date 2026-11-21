// The Food space's Nutrients tab (21.11.2026): each line against its target, the unknown mark, the foods by their share of a
// nutrient, a food's details, the period switch; against real answers of the door (tests/samples/food_space.json).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  amount,
  askedPeriod,
  details,
  foodAmount,
  foodLine,
  foodsBy,
  libraryHref,
  lineView,
  mealsBy,
  nutrientsHref,
  periodLinks,
  periodNote,
  periodSpan,
  type NutrientLine,
  type Nutrients,
} from './nutrients.js';

const SAMPLE = JSON.parse(readFileSync(new URL('../../tests/samples/food_space.json', import.meta.url), 'utf8'));
const DAY: Nutrients = SAMPLE.day.food_nutrients;
const WEEK: Nutrients = SAMPLE.week.food_nutrients;
const line = (x: Nutrients, k: string) => x.nutrients.find((l) => l.key === k)!;
const made = (l: Partial<NutrientLine>): NutrientLine => ({
  key: 'protein', label: 'Protein', unit: 'g', sub: false, aim: 'reach', sum: 0, value: 0, unknown: 0, unknown_foods: 0, target: null, ...l,
});

describe('the lines', () => {
  it('are the door’s ten, in its order', () => {
    expect(DAY.nutrients.map((l) => l.key)).toEqual(['kcal', 'protein', 'fat', 'sat_fat', 'carbs', 'sugar_total', 'sugar_added', 'fibre', 'salt', 'caffeine_mg']);
  });

  it('say how far from a target, in words: to go or reached for one to reach, left or over for one to stay under', () => {
    expect(lineView(made({ value: 57.2, target: 150 })).gap).toBe('93 g to go');
    expect(lineView(made({ value: 160, target: 150 })).gap).toBe('reached');
    const under = { key: 'sugar_added' as const, label: 'Added sugar', aim: 'under' as const, target: 25 };
    expect(lineView(made({ ...under, value: 20 })).gap).toBe('5 g left');
    expect(lineView(made({ ...under, value: 31 })).gap).toBe('6 g over');
    expect(lineView(made({ ...under, value: 31 })).pct).toBe(100);
    expect(lineView(made({ value: 5 })).gap).toBe('');
    expect(lineView(made({ value: 5 })).target).toBe('');
  });

  it('mark a total made with foods that have no value: "at least", and how many foods', () => {
    const v = lineView(made({ key: 'sugar_added', label: 'Added sugar', value: 31, unknown: 2, unknown_foods: 2 }));
    expect(v.value).toBe('at least 31 g');
    expect(v.unknown).toBe('2 foods without a value');
    expect(lineView(made({ value: 3, unknown: 1, unknown_foods: 1 })).unknown).toBe('1 food without a value');
    // the sample: added sugar is not known for the fruit bar and the rye bread
    const s = lineView(line(DAY, 'sugar_added'));
    expect(s.value.startsWith('at least ')).toBe(true);
    expect(s.unknown).toBe('2 foods without a value');
    expect(lineView(line(DAY, 'kcal')).unknown).toBeNull();
  });

  it('write salt in grams with its sodium beside it', () => {
    const s = lineView(line(DAY, 'salt'));
    expect(s.extra).toMatch(/^[\d,]+ mg sodium$/);
    expect(amount('salt', 0.21)).toBe('0.21');
    expect(amount('fat', 9)).toBe('9');
    expect(amount('salt', 5.6)).toBe('5.6');
    expect(amount('sugar_total', 2.7)).toBe('2.7');
    expect(amount('sugar_total', 38.4)).toBe('38');
    expect(amount('caffeine_mg', 95)).toBe('95');
    expect(amount('kcal', null)).toBe('–');
  });
});

describe('the foods', () => {
  it('come most kcal first without a nutrient picked', () => {
    const f = foodsBy(DAY, null);
    expect(f.map((x) => x.food.name)).toEqual(DAY.foods.map((x) => x.name));
    expect(f[0]!.text).toBe('');
  });

  it('come by their share of a nutrient, largest first, each with its share; those without a value last', () => {
    const f = foodsBy(DAY, 'sugar_added');
    const known = f.filter((x) => x.value !== null);
    for (let i = 1; i < known.length; i++) expect(known[i - 1]!.value!).toBeGreaterThanOrEqual(known[i]!.value!);
    expect(f.slice(-2).map((x) => x.text)).toEqual(['Added sugar unknown', 'Added sugar unknown']);
    expect(known[0]!.text).toMatch(/^Added sugar [\d.]+ g · \d+%$/);
    const sum = known.reduce((a, x) => a + x.share, 0);
    expect(Math.round(sum)).toBe(100);
    expect(foodsBy(DAY, 'sugar_total')[0]!.text.startsWith('Sugar ')).toBe(true);
  });

  it('show their amount, times eaten over a period, and the short line', () => {
    expect(foodAmount({ amount: 300, unit: 'g', entries: 1 })).toBe('300 g');
    expect(foodAmount({ amount: 1250, unit: 'ml', entries: 5 })).toBe('1,250 ml · 5 times');
    expect(foodLine({ kcal: 420, protein: 18, fat: 9, carbs: 66 } as never)).toBe('420 kcal · P 18 · F 9 · C 66');
  });

  it('open to every value for the amount eaten and per 100, sodium under salt, "unknown" where there is none', () => {
    const f = DAY.foods[0]!;
    const d = details(f, DAY.nutrients);
    expect(d.map((x) => x.key)).toEqual(['kcal', 'protein', 'fat', 'sat_fat', 'carbs', 'sugar_total', 'sugar_added', 'fibre', 'salt', 'sodium_mg', 'caffeine_mg']);
    expect(d.find((x) => x.key === 'caffeine_mg')!.eaten).toBe('unknown');
    expect(d[0]!.eaten).toBe(`${amount('kcal', f.values.kcal)} kcal`);
    expect(libraryHref(f)).toBe(`/library?food=${f.ref}`);
  });
});

describe('by meal and the period', () => {
  it('gives each meal its value and share of the day', () => {
    const m = mealsBy(DAY, null);
    expect(m.map((x) => x.label)).toEqual(DAY.meals.map((x) => x.label));
    expect(m[0]!.text).toMatch(/kcal · \d+%$/);
    expect(mealsBy(WEEK, 'kcal')).toEqual([]);
  });

  it('reads ?days= as 1, 7 or 30 and makes the addresses', () => {
    expect([askedPeriod('7'), askedPeriod('30'), askedPeriod('5'), askedPeriod(null)]).toEqual([7, 30, 1, 1]);
    expect(nutrientsHref(null, 1)).toBe('/food/nutrients');
    expect(nutrientsHref('2026-11-15', 7, '2026-11-21')).toBe('/food/nutrients?day=2026-11-15&days=7');
    expect(nutrientsHref('2026-11-21', 30, '2026-11-21')).toBe('/food/nutrients?days=30');
  });

  it('moves a whole period with ‹ and ›, never past today', () => {
    expect(periodLinks({ day: '2026-11-21', today: '2026-11-21', past: false, days: 7 })).toEqual({ before: '/food/nutrients?day=2026-11-14&days=7', after: null });
    expect(periodLinks({ day: '2026-11-17', today: '2026-11-21', past: true, days: 7 })).toEqual({ before: '/food/nutrients?day=2026-11-10&days=7', after: '/food/nutrients?days=7' });
    expect(periodLinks({ day: '2026-11-10', today: '2026-11-21', past: true, days: 1 }).after).toBe('/food/nutrients?day=2026-11-11');
  });

  it('says the span and how many days the average is of', () => {
    expect(periodSpan(DAY)).toBeNull();
    expect(periodNote(DAY)).toBeNull();
    expect(periodSpan({ start: '2026-11-15', end: '2026-11-21', per_day: true })).toBe('15.11. – 21.11.');
    expect(periodNote({ per_day: true, eaten_days: 3, days: 7 })).toBe('Average per day of the 3 days with food (of 7).');
    expect(periodNote({ per_day: true, eaten_days: 1, days: 7 })).toBe('Average per day of the 1 day with food (of 7).');
    expect(periodNote({ per_day: true, eaten_days: 0, days: 30 })).toBe('No food logged in these 30 days.');
  });
});
