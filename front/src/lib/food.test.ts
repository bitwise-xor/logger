// The Food day's plain rules (step E): the four tiles, the rows by meal, the day switch, and what a changed amount becomes.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  amountText,
  askedDay,
  becomes,
  becomesText,
  dayLinks,
  foodBlocks,
  inUnit,
  parseAmount,
  shiftDay,
  stepped,
  tiles,
  type FoodDay,
  type FoodEntry,
} from './food.js';

/** Real answers of the door (tests/test_front_samples.py writes them): an invented day and the day before. */
const SAMPLE = JSON.parse(readFileSync(new URL('../../tests/samples/food.json', import.meta.url), 'utf8'));
const TODAY: FoodDay = SAMPLE.food_day.food_day;
const BEFORE: FoodDay = SAMPLE.before.food_day;
const ENTRY: FoodEntry = SAMPLE.entry.entry;
const copy = (): FoodDay => structuredClone(TODAY);

describe('the four tiles', () => {
  it('shows each total against its target, with what is left, as app. rounds', () => {
    const t = tiles(TODAY);
    expect(t.map((x) => x.name)).toEqual(['Calories', 'Protein', 'Fat', 'Carbs']);
    // 1399.5 kcal: half to even, as Python's round()
    expect(t[0]).toMatchObject({ value: '1,400', target: '2,100 kcal', left: '700 kcal left' });
    expect(t[1]).toMatchObject({ value: '57', target: '150 g', left: '93 g to go' });
    expect(t[0]!.pct).toBeCloseTo((1399.5 / 2100) * 100);
  });

  it('says plainly when a total is over its target, and a full bar', () => {
    const d = copy();
    d.totals.fat = 82;
    const fat = tiles(d)[2]!;
    expect(fat.left).toBe('12 g over');
    expect(fat.pct).toBe(100);
  });

  it('shows the amount without a target when none is set', () => {
    const d = copy();
    d.targets.carbs = null;
    expect(tiles(d)[3]).toMatchObject({ target: '', pct: 0, left: 'no target' });
  });
});

describe('the rows by meal', () => {
  it('lists the newest meal first and the drinks last, each meal with its kcal', () => {
    const b = foodBlocks(TODAY);
    expect(b.map((x) => x.label)).toEqual(['Meal 2', 'Meal 1', 'Drinks']);
    expect(b[0]!.total).toBe('934 kcal'); // 934.5: half to even
    expect(b.flatMap((x) => x.lines).length).toBe(TODAY.rows.length);
  });

  it('puts the newest row of a meal first and keeps the note', () => {
    const meal2 = foodBlocks(TODAY)[0]!;
    expect(meal2.lines[0]!.time).toBe('13:05');
    const soup = meal2.lines.find((l) => l.name === 'Lentil soup')!;
    expect(soup.note).toBe('toasted');
    expect(soup).toMatchObject({ amount: '350 g', kcal: '410 kcal', protein: '24 g' });
  });

  it('shows the amount with its portion, and one decimal when it has one', () => {
    const oats = foodBlocks(TODAY)[1]!.lines[0]!;
    expect(oats.amount).toBe('300 g (1 bowl)');
    expect(oats.sub).toBe('300 g (1 bowl) · 18 g protein');
    expect(amountText(12.5)).toBe('12.5');
    expect(amountText(1500)).toBe('1,500');
  });

  it('keeps a row without a known time, last in its meal', () => {
    const d = copy();
    const r = d.rows.find((x) => x.food === 'Fruit bar')!;
    r.time_known = false;
    r.at = null;
    const meal2 = foodBlocks(d)[0]!;
    expect(meal2.lines.at(-1)!.name).toBe('Fruit bar');
    expect(meal2.lines.at(-1)!.time).toBe('');
  });

  it('has no blocks on an empty day', () => {
    expect(foodBlocks({ ...copy(), rows: [], meals: [] })).toEqual([]);
  });
});

describe('the day switch', () => {
  it('moves by whole days across a month and a year', () => {
    expect(shiftDay('2026-11-01', -1)).toBe('2026-10-31');
    expect(shiftDay('2026-12-31', 1)).toBe('2027-01-01');
    expect(shiftDay('2026-03-29', 1)).toBe('2026-03-30'); // the clocks change that night
  });

  it('leads to the day before always, and to the day after only from a past day', () => {
    expect(dayLinks(TODAY)).toEqual({ before: `/food?day=${shiftDay(TODAY.day, -1)}`, after: null });
    // the day after yesterday is today: /food plain
    expect(dayLinks(BEFORE)).toEqual({ before: `/food?day=${shiftDay(BEFORE.day, -1)}`, after: '/food' });
    const older = { ...BEFORE, day: shiftDay(BEFORE.day, -3) };
    expect(dayLinks(older).after).toBe(`/food?day=${shiftDay(BEFORE.day, -2)}`);
  });

  it('asks the door only for a real date', () => {
    expect(askedDay('2026-11-15')).toBe('2026-11-15');
    for (const bad of [null, '', '2026-02-30', '15.11.2026', '2026-11-15x', '../day']) expect(askedDay(bad)).toBeUndefined();
  });
});

describe('changing a row', () => {
  it('reads an amount as typed, with a comma or a point', () => {
    expect(parseAmount(' 80 ')).toBe(80);
    expect(parseAmount('80,5')).toBe(80.5);
    for (const bad of ['', '0', '-5', 'lots', '8e2', '1.2.3']) expect(parseAmount(bad)).toBeNull();
  });

  it('steps 5 g under 100 g, 25 g from there, 1 in another unit, never below one step', () => {
    expect(stepped(80, 1, 1)).toBe(85);
    expect(stepped(100, 1, 1)).toBe(125);
    expect(stepped(100, 1, -1)).toBe(75);
    expect(stepped(5, 1, -1)).toBe(5);
    expect(stepped(2, 40, 1)).toBe(3);
    expect(stepped(1, 40, -1)).toBe(1);
  });

  it('works out what the row becomes, in its own unit or another', () => {
    const bread = TODAY.rows.find((r) => r.ref === ENTRY.ref)!;
    expect(becomesText(becomes(bread, 80))).toBe('200 kcal · 6 g protein');
    expect(becomesText(becomes(bread, 160))).toBe('400 kcal · 12 g protein');
    // two slices of 40 g = 80 g
    expect(becomesText(becomes(bread, 2, ENTRY.units[1]!.in_basis))).toBe('200 kcal · 6 g protein');
    expect(becomesText(becomes(bread, null))).toBe('–');
    expect(becomes({ ...bread, amount: 0 }, 50)).toBeNull();
  });

  it('turns the amount into another unit when the unit is switched', () => {
    expect(inUnit(80, 1, 40)).toBe(2);
    expect(inUnit(2, 40, 1)).toBe(80);
    expect(inUnit(50, 1, 35)).toBe(1.4);
  });
});
