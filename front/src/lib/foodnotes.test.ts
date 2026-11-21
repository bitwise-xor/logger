// The Food space's Notes tab (21.11.2026): the notes by day, each leading to its Food day; against a real answer of the door
// (tests/samples/food_space.json).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { noteDays, type FoodNotes } from './foodnotes.js';

const SAMPLE = JSON.parse(readFileSync(new URL('../../tests/samples/food_space.json', import.meta.url), 'utf8'));
const NOTES: FoodNotes = SAMPLE.notes.food_notes;

describe('the notes', () => {
  it('are grouped by day, newest first, today said', () => {
    const d = noteDays(NOTES);
    expect(d.map((x) => x.day)).toEqual([...new Set(NOTES.notes.map((n) => n.day))]);
    expect(d[0]!.today).toBe(true);
    expect(d[1]!.today).toBe(false);
    expect(d[0]!.title).toMatch(/^\w{3} \d\d\.\d\d\.$/);
    expect(d[0]!.href).toBe('/food');
    expect(d[1]!.href).toBe(`/food?day=${d[1]!.day}`);
  });

  it('say what each is on and lead there: a food’s note opens its row, a meal’s note its meal', () => {
    const today = noteDays(NOTES)[0]!;
    const food = today.rows.find((r) => r.kind === 'food')!;
    expect(food.what).toBe('Rye bread · 80 g (2 slices)');
    expect(food.sub).toBe('Meal 2 · 13:05');
    expect(food.href).toMatch(/^\/food\?open=f\d+$/);
    const meal = today.rows.find((r) => r.kind === 'meal')!;
    expect(meal.what).toBe('Meal 2 · 10:30');
    expect(meal.href).toBe('/food#meal-2');
    const older = noteDays(NOTES)[1]!.rows[0]!;
    expect(older.href).toBe(`/food?day=${noteDays(NOTES)[1]!.day}#meal-1`);
  });

  it('can be a note on a day whose meals are gone', () => {
    const d = noteDays({ ...NOTES, notes: [{ kind: 'day', day: '2026-11-01', meal: null, label: null, at: null, note: 'fasting' }] });
    expect(d[0]!.rows[0]!).toMatchObject({ kind: 'day', what: 'The day', note: 'fasting', href: '/food?day=2026-11-01' });
    expect(noteDays({ ...NOTES, notes: [] })).toEqual([]);
  });
});
