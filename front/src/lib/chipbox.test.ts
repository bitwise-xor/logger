// The boxes under Today's chips (deploy 117), with a made-up usual meal.
import { describe, expect, it } from 'vitest';
import { againFields, becomes, becomesLine, ready, startPicks, usualFields } from './chipbox.js';
import type { UsualItem } from './day.js';

const ITEMS: UsualItem[] = [
  { item_id: 11, food: 'Porridge oats', amount: 60, unit: 'g', nutrients: { kcal: 228, protein: 8, fat: 4, carbs: 36 } },
  { item_id: 12, food: 'Plain yoghurt', amount: 200, unit: 'g', nutrients: { kcal: 120, protein: 20, fat: 1, carbs: 8 } },
  { item_id: 13, food: 'Honey', amount: 12.5, unit: 'g', nutrients: { kcal: 40, protein: 0, fat: 0, carbs: 10 } },
];

describe("a usual meal's box", () => {
  it('opens with every food ticked at its saved amount', () => {
    expect(startPicks(ITEMS)).toEqual([
      { item_id: 11, on: true, amount: '60' },
      { item_id: 12, on: true, amount: '200' },
      { item_id: 13, on: true, amount: '12.5' },
    ]);
    expect(becomesLine(ITEMS, startPicks(ITEMS))).toBe('388 kcal · P 28 · F 5 · C 54 g');
  });

  it('scales each ticked food by its new amount over its saved one, and leaves out the others', () => {
    const picks = startPicks(ITEMS);
    picks[0]!.amount = '90'; // 1.5 times
    picks[2]!.on = false;
    expect(becomes(ITEMS, picks)).toEqual({ kcal: 342 + 120, protein: 12 + 20, fat: 6 + 1, carbs: 54 + 8 });
    picks[1]!.amount = '100,5'; // a comma as a point
    expect(becomes(ITEMS, picks)?.kcal).toBeCloseTo(342 + 60.3);
  });

  it('may not log with nothing ticked or a ticked amount that is not a number above 0', () => {
    const picks = startPicks(ITEMS);
    picks[1]!.amount = '0';
    expect(ready(picks)).toBe(false);
    expect(becomes(ITEMS, picks)).toBeNull();
    expect(becomesLine(ITEMS, picks)).toBe('Give each ticked food an amount above 0.');
    picks[1]!.on = false; // an untouched amount does not count
    expect(ready(picks)).toBe(true);
    for (const p of picks) p.on = false;
    expect(ready(picks)).toBe(false);
    expect(becomesLine(ITEMS, picks)).toBe('Tick at least one food.');
  });

  it('sends only the ticked foods, as item_id and amount pairs in their order, and the time when one is given', () => {
    const picks = startPicks(ITEMS);
    picks[1]!.on = false;
    picks[2]!.amount = ' 15,5 ';
    expect(usualFields(4, picks, '07:30')).toEqual({ meal_id: '4', item_id: ['11', '13'], amount: ['60', '15.5'], time: '07:30' });
    expect(usualFields(4, picks, '')).not.toHaveProperty('time');
  });
});

describe("an Again chip's box", () => {
  it('sends the food, the amount and the time (none: now)', () => {
    expect(againFields(7, '95', '12:10')).toEqual({ food_id: '7', amount: '95', time: '12:10' });
    expect(againFields(7, '2,5', '')).toEqual({ food_id: '7', amount: '2.5' });
  });
});
