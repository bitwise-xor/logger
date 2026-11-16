// The Usual meals page (deploy 87) against tests/samples/usual.json, a real answer of the door: the cards, the editor's totals and
// what changed, the fields one Save sends, and the search (newest answer wins).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  addedRow,
  canSave,
  cards,
  changeCount,
  changeLine,
  cleanName,
  countLine,
  deleteFields,
  draftOf,
  FoodSearch,
  live,
  more,
  newDraft,
  perText,
  problem,
  removed,
  rowStatus,
  saveFields,
  searchUrl,
  swapped,
  totals,
  totalText,
  typedAmount,
  type FoodHit,
  type Usual,
} from './usual.js';

/** Real answers of the door (tests/test_front_samples.py writes them): GET /usual and GET /foods?q= for invented meals and foods. */
const sample = JSON.parse(readFileSync(new URL('../../tests/samples/usual.json', import.meta.url), 'utf8'));
const list = sample.usual.usual as Usual[];
const hits = sample.foods.foods as FoodHit[];
const breakfast = list.find((u) => u.name === 'Usual breakfast')!;
const cocoa = list.find((u) => u.name === 'Cocoa')!;
const oatsMix = hits.find((h) => h.name === 'Oats with milk and banana')!;

describe('the list', () => {
  it('shows each meal with its foods, kcal and protein, in the door’s order', () => {
    expect(cards(list)).toEqual([
      { meal_id: cocoa.meal_id, name: 'Cocoa', drink: true, items: 'Milk 250 ml', kcal: '115 kcal', protein: '8 g P' },
      { meal_id: breakfast.meal_id, name: 'Usual breakfast', drink: false, items: 'Oats 60 g · Skyr 200 g', kcal: '354 kcal', protein: '30 g P' },
    ]);
  });

  it('counts meals and drinks', () => {
    expect(countLine(list)).toBe('1 meal and 1 drink, by name.');
    expect(countLine([])).toBe('0 meals and 0 drinks, by name.');
  });
});

describe('the editor', () => {
  it('opens a meal with nothing changed and its totals as saved', () => {
    const d = draftOf(breakfast);
    expect(d.rows.map(rowStatus)).toEqual(['', '']);
    expect(changeCount(d)).toBe(0);
    expect(canSave(d)).toBe(false);
    expect(totalText(totals(live(d)))).toBe(totalText(breakfast.nutrients));
    expect(changeLine(d)).toBe('Nothing changed yet.');
  });

  it('works out the total of a changed amount from the item’s own values', () => {
    const d = draftOf(breakfast);
    d.rows[0] = { ...d.rows[0], amount: 90 }; // oats 60 g -> 90 g: 228 kcal -> 342
    const t = totals(live(d));
    expect(t.kcal).toBeCloseTo(342 + 126);
    expect(t.protein).toBeCloseTo(7.8 * 1.5 + 22);
    expect(rowStatus(d.rows[0])).toBe('Changed · was 60 g');
    expect(changeLine(d)).toBe('1 change, not saved yet. One Save for all, one Undo.');
  });

  it('steps 5 at a time under 100 and 25 above, never below one step or above 5000', () => {
    expect(more(60, 1)).toBe(65);
    expect(more(100, 1)).toBe(125);
    expect(more(5, -1)).toBe(5);
    expect(more(4990, 1)).toBe(5000);
    expect(typedAmount('37,5')).toBe(37.5);
    expect(typedAmount('0')).toBeNull();
    expect(typedAmount('5001')).toBeNull();
    expect(typedAmount('abc')).toBeNull();
  });

  it('swaps a food: the same amount, the new food’s values per 100', () => {
    const d = draftOf(breakfast);
    d.rows[0] = swapped(d.rows[0], oatsMix);
    expect(rowStatus(d.rows[0])).toBe('Swapped · was Oats');
    expect(totals([d.rows[0]]).kcal).toBeCloseTo((oatsMix.per_100.kcal * 60) / 100);
    d.rows[0] = { ...d.rows[0], amount: 100 };
    expect(rowStatus(d.rows[0])).toBe('Swapped · was Oats, 60 g');
  });

  it('removes a saved food until Save (struck through), and drops a food added here', () => {
    const d = draftOf(breakfast);
    d.rows = removed(d, d.rows[1].id);
    expect(d.rows.map(rowStatus)).toEqual(['', 'Removed']);
    expect(totals(live(d)).kcal).toBeCloseTo(228);
    d.rows = [...d.rows, addedRow(oatsMix, 'n1')];
    expect(rowStatus(d.rows[2])).toBe('New');
    expect(d.rows[2].amount).toBe(100);
    d.rows = removed(d, 'n1');
    expect(d.rows).toHaveLength(2);
    expect(changeCount(d)).toBe(1);
  });

  it('counts a new name as a change, but not spaces around it', () => {
    const d = draftOf(breakfast);
    d.name = '  Usual   breakfast ';
    expect(changeCount(d)).toBe(0);
    d.name = 'Big breakfast';
    expect(changeCount(d)).toBe(1);
    expect(cleanName('  a   b ')).toBe('a b');
  });

  it('says what stops a Save before it is sent', () => {
    const d = newDraft();
    expect(canSave(d)).toBe(true);
    expect(problem(d)).toMatch(/name/);
    d.name = 'Shake';
    expect(problem(d)).toBe('Add at least one food.');
    d.rows = Array.from({ length: 9 }, (_, k) => addedRow(oatsMix, `n${k}`));
    expect(problem(d)).toBe('Up to 8 foods in a new usual meal.');
    const e = draftOf(cocoa);
    e.rows = removed(e, e.rows[0].id);
    expect(problem(e)).toMatch(/use Delete/);
  });
});

describe('what a Save sends', () => {
  it('a changed meal: its id, the name and the whole list in order, without the removed foods', () => {
    const d = draftOf(breakfast);
    d.name = 'Big breakfast';
    d.rows = removed(d, d.rows[0].id);
    d.rows = [...d.rows, { ...addedRow(oatsMix, 'n1'), amount: 150 }];
    expect(saveFields(d)).toEqual({
      action: 'usual_meal',
      fields: { meal_id: String(breakfast.meal_id), action: 'save', name: 'Big breakfast', food_id: ['8', String(oatsMix.food_id)], amount: ['200', '150'] },
    });
  });

  it('a new meal or drink: the name, meal or drink, and its foods', () => {
    const d = newDraft();
    d.name = ' Shake ';
    d.drink = true;
    d.rows = [addedRow(oatsMix, 'n1')];
    expect(saveFields(d)).toEqual({ action: 'usual_new', fields: { name: 'Shake', drink: '1', food_id: [String(oatsMix.food_id)], amount: ['100'] } });
  });

  it('a delete: the meal and the action', () => {
    expect(deleteFields(draftOf(cocoa))).toEqual({ meal_id: String(cocoa.meal_id), action: 'delete' });
  });
});

describe('the search', () => {
  it('asks this app’s own route, the words trimmed', () => {
    expect(searchUrl('  oat milk ')).toBe('/food/usual/foods?q=oat%20milk');
    expect(perText(oatsMix)).toBe('140 kcal · 6 g protein per 100 g');
  });

  it('shows only the newest answer: an older one that comes back later is dropped', async () => {
    const waiting: Record<string, (h: FoodHit[]) => void> = {};
    const s = new FoodSearch((q) => new Promise((done) => (waiting[q] = done)));
    const first = s.find('o');
    const second = s.find('oa');
    waiting.oa([oatsMix]);
    waiting.o(hits);
    expect(await second).toEqual([oatsMix]);
    expect(await first).toBeNull();
  });

  it('drops an answer once the search is closed, and reads a failed one as no foods', async () => {
    let done: (h: FoodHit[]) => void = () => {};
    const s = new FoodSearch(() => new Promise((d) => (done = d)));
    const p = s.find('oats');
    s.stop();
    done(hits);
    expect(await p).toBeNull();
    const failing = new FoodSearch(() => Promise.reject(new Error('offline')));
    expect(await failing.find('oats')).toEqual([]);
  });
});
