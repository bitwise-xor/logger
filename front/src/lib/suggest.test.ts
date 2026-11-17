// The logging box's food suggestions (deploy 117): app.'s rules (suggestFoods in core/app/static/app.js), with made-up foods.
import { describe, expect, it } from 'vitest';
import { fold, lastAmount, moved, picked, suggest, typedPart, type SuggestFood } from './suggest.js';

const food = (food_id: number, name: string, more: Partial<SuggestFood> = {}): SuggestFood => ({
  food_id,
  name,
  unit: 'g',
  words: [],
  last_amount: null,
  eaten: 0,
  last_at: null,
  ...more,
});

const FOODS = [
  food(1, 'Oats', { last_amount: 60, eaten: 40, last_at: '2026-11-16T07:00:00+01:00' }),
  food(2, 'Oat drink', { unit: 'ml', last_amount: 200, eaten: 3, last_at: '2026-11-10T07:00:00+01:00' }),
  food(3, 'Knuspermüsli', { words: ['muesli', 'granola'], last_amount: 45, eaten: 5, last_at: '2026-11-01T07:00:00+01:00' }),
  food(4, 'Roasted vegetables', { last_amount: 250, eaten: 9, last_at: '2026-11-15T19:00:00+01:00' }),
  food(5, 'Eggs (boiled)', { last_amount: 120, eaten: 2, last_at: '2026-10-01T07:00:00+01:00' }),
  food(6, 'Vinegar', { unit: 'ml', last_amount: 12.25, eaten: 30, last_at: '2026-11-16T12:00:00+01:00' }),
  food(7, 'Grießbrei', { eaten: 1 }),
];
const names = (q: string, foods = FOODS) => suggest(foods, q).map((s) => s.food.name);

describe('the part being typed', () => {
  it('starts after the last comma, semicolon, line break or "and"', () => {
    expect(typedPart('apple, oa', 9)).toEqual({ start: 7, end: 9, q: 'oa' });
    expect(typedPart('tea; oa', 7).q).toBe('oa');
    expect(typedPart('tea\noa', 6).q).toBe('oa');
    expect(typedPart('tea and Oa', 10)).toEqual({ start: 8, end: 10, q: 'oa' });
    // "and" only as a word: "banana" is one part
    expect(typedPart('banana', 6).q).toBe('banana');
  });
  it('skips an amount in front, which a pick then replaces too', () => {
    expect(typedPart('150 g oa', 8)).toEqual({ start: 0, end: 8, q: 'oa' });
    expect(typedPart('apple, 2x eg', 12).q).toBe('eg');
    expect(typedPart('apple, 12,5ml oa', 16).q).toBe('oa');
  });
  it('ends at the caret', () => {
    expect(typedPart('oats, milk', 2)).toEqual({ start: 0, end: 2, q: 'oa' });
  });
});

describe('the suggestions', () => {
  it('needs 2 letters', () => {
    expect(names('o')).toEqual([]);
    // a word that starts with it first, then "roasted", which has it inside
    expect(names('oa')).toEqual(['Oats', 'Oat drink', 'Roasted vegetables']);
  });
  it('puts words that start with the letters first, then by the most recently eaten, then the most eaten', () => {
    // "eg": Eggs starts with it; vegetables and vinegar only have it inside a word, recent as they are
    expect(names('eg')).toEqual(['Eggs (boiled)', 'Vinegar', 'Roasted vegetables']);
    const same = [food(1, 'Pear a', { eaten: 2 }), food(2, 'Pear b', { eaten: 9 }), food(3, 'Pear c', { eaten: 1, last_at: '2026-11-01T07:00:00Z' })];
    expect(names('pe', same)).toEqual(['Pear c', 'Pear b', 'Pear a']);
  });
  it('finds a word of the name, and a food by one of its own words, which it shows', () => {
    expect(names('veg')).toEqual(['Roasted vegetables']);
    const s = suggest(FOODS, 'gran');
    expect(s.map((x) => [x.food.name, x.word])).toEqual([['Knuspermüsli', 'granola']]);
  });
  it('folds ü, ö, ä and ß both ways', () => {
    expect(fold('Grießbrei Müsli Öl Bär')).toBe('griessbrei muesli oel baer');
    expect(names('muesli')).toEqual(['Knuspermüsli']); // its word starts with it
    expect(suggest(FOODS, 'muesli')[0]!.word).toBe('muesli');
    expect(names('müs')).toEqual(['Knuspermüsli']);
    expect(names('griess')).toEqual(['Grießbrei']);
    expect(names('grieß')).toEqual(['Grießbrei']);
  });
  it('shows 6 at most', () => {
    const many = Array.from({ length: 9 }, (_, i) => food(i + 1, `Tea ${i + 1}`, { eaten: i }));
    expect(names('te', many)).toEqual(['Tea 9', 'Tea 8', 'Tea 7', 'Tea 6', 'Tea 5', 'Tea 4']);
  });
  it('takes words without letters to match as nothing', () => {
    expect(names('zz')).toEqual([]);
  });
});

describe('a pick', () => {
  it('puts in the name and the amount eaten last, the caret after it', () => {
    expect(picked('apple, 150 g oa', 15, FOODS[0]!)).toEqual({ value: 'apple, Oats 60 g', caret: 16 });
    expect(picked('oa, milk', 2, FOODS[1]!)).toEqual({ value: 'Oat drink 200 ml, milk', caret: 16 });
  });
  it('writes the amount to one decimal, and none for a food never eaten', () => {
    expect(lastAmount(FOODS[5]!)).toBe(' 12.3 ml');
    expect(picked('grie', 4, FOODS[6]!)).toEqual({ value: 'Grießbrei', caret: 9 });
  });
});

describe('the arrows', () => {
  it('go round, from none to the first or the last', () => {
    expect(moved(-1, 3, true)).toBe(0);
    expect(moved(2, 3, true)).toBe(0);
    expect(moved(-1, 3, false)).toBe(2);
    expect(moved(0, 3, false)).toBe(2);
    expect(moved(1, 3, false)).toBe(0);
    expect(moved(-1, 0, true)).toBe(-1);
  });
});
