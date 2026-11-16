import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  chipNames,
  freshRefs,
  habitsDone,
  headerLine,
  healthLines,
  kcalLeft,
  macroBars,
  macroPie,
  macroText,
  needsCount,
  reviewText,
  timeline,
  type Day,
  type FoodRow,
  type ValueRow,
} from './day.js';

/** A real answer of the door (tests/test_front_samples.py writes it): an invented day read at 16:10, woken at 05:40. */
const SAMPLE: Day = JSON.parse(readFileSync(new URL('../../tests/samples/day.json', import.meta.url), 'utf8')).day;
const copy = (): Day => structuredClone(SAMPLE);

const food = (ref: string, meal: number, at: string | null, kcal: number, name = ref): FoodRow => ({
  ref,
  kind: 'food',
  meal,
  at,
  time_known: at !== null,
  food: name,
  food_id: 1,
  amount: 100,
  unit: 'g',
  portion_text: null,
  nutrients: { kcal, protein: 1, fat: 1, carbs: 1 },
  usual_meal: null,
});
const value = (ref: string, type: string, at: string, v1: number | null = null): ValueRow => ({
  ref,
  kind: v1 === null ? 'event' : 'measurement',
  type,
  label: type,
  at,
  time_known: true,
  v1,
  v2: null,
  unit: null,
  period: null,
  needs_review: false,
});
const T = (h: string) => `2026-11-16T${h}:00+01:00`;

function dayWith(rows: Day['rows'], meals: [number, string, number][] = []): Day {
  const d = copy();
  d.rows = rows;
  d.energy.meals = meals.map(([meal, label, kcal]) => ({ meal, label, nutrients: { kcal, protein: 0, fat: 0, carbs: 0 } }));
  d.habits = [{ name: 'meds', label: 'Medication', done: 1, target: 1, complete: true, avoid: false, last_tick: null }];
  return d;
}

describe('the header line', () => {
  it('has the date, the hour of the day and the wake-up', () => {
    expect(headerLine(SAMPLE)).toBe('Mon 16.11. · hour 11 of your day · woke 05:40');
  });
  it('counts the first hour after waking as hour 1', () => {
    const d = copy();
    d.header.awake_minutes = 0;
    expect(headerLine(d)).toContain('hour 1 of your day');
    d.header.awake_minutes = 59;
    expect(headerLine(d)).toContain('hour 1 of your day');
    d.header.awake_minutes = 60;
    expect(headerLine(d)).toContain('hour 2 of your day');
  });
  it('is the date alone without a wake-up', () => {
    const d = copy();
    d.header.awake_minutes = null;
    d.header.wake_at = null;
    expect(headerLine(d)).toBe('Mon 16.11.');
  });
});

describe('kcal left', () => {
  it("is the target less the day's kcal, as app.'s Calories tile", () => {
    // 2,100 target, 1,399.5 eaten: 700.5 left, which app. shows as 700 (Python rounds halves to even)
    expect(SAMPLE.energy.totals.kcal).toBe(1399.5);
    expect(kcalLeft(SAMPLE.energy)).toEqual({ big: '700', after: 'kcal left of', target: '2,100' });
  });
  it('says how far over the target', () => {
    const e = copy().energy;
    e.totals.kcal = 2350.4;
    expect(kcalLeft(e)).toEqual({ big: '250', after: 'kcal over', target: '2,100' });
  });
  it('shows the kcal eaten without a target', () => {
    const e = copy().energy;
    e.targets.kcal = null;
    expect(kcalLeft(e)).toEqual({ big: '1,400', after: 'kcal eaten, no target set', target: '' });
  });
});

describe('the Energy card lines', () => {
  it('lists kcal and all three macros against their targets', () => {
    const t = SAMPLE.energy.totals;
    expect(macroBars(SAMPLE.energy)).toEqual([
      { name: 'Eaten', key: null, value: t.kcal, target: 2100, unit: 'kcal', share: '' },
      { name: 'Protein', key: 'protein', value: t.protein, target: 150, unit: 'g', share: '16 %' },
      { name: 'Fat', key: 'fat', value: t.fat, target: 70, unit: 'g', share: '26 %' },
      { name: 'Carbs', key: 'carbs', value: t.carbs, target: 250, unit: 'g', share: '58 %' },
    ]);
  });
  it('still lists a macro without a target (no bar), and leaves kcal to the big number', () => {
    const e = copy().energy;
    e.targets = { kcal: null, protein: null, fat: 70, carbs: null };
    expect(macroBars(e).map((b) => [b.name, b.target])).toEqual([['Protein', null], ['Fat', 70], ['Carbs', null]]);
  });
  it('says no share before anything is eaten', () => {
    const e = copy().energy;
    e.totals = { kcal: 0, protein: 0, fat: 0, carbs: 0 };
    expect(macroBars(e).map((b) => b.share)).toEqual(['', '', '', '']);
  });
});

describe('the macro pie', () => {
  it('splits the kcal from protein and carbs (4 per g) and fat (9 per g), in app.\'s order, the day\'s kcal in the middle', () => {
    const pie = macroPie(SAMPLE.energy)!;
    const whole = 57.2 * 4 + 206.2 * 4 + 40.2 * 9;
    expect(pie.kcal).toBe('1,400'); // 1399.5, halves to even as app.
    expect(pie.slices.map((s) => s.key)).toEqual(['protein', 'carbs', 'fat']);
    expect(pie.slices.map((s) => s.share)).toEqual([(57.2 * 4) / whole, (206.2 * 4) / whole, (40.2 * 9) / whole]);
    expect(pie.slices.reduce((a, s) => a + s.share, 0)).toBeCloseTo(1, 10);
  });
  it('is not drawn before anything is eaten, and takes the macros\' kcal when the day has none', () => {
    const e = copy().energy;
    e.totals = { kcal: 0, protein: 0, fat: 0, carbs: 0 };
    expect(macroPie(e)).toBeNull();
    e.totals = { kcal: 0, protein: 10, fat: 0, carbs: 0 };
    expect(macroPie(e)).toMatchObject({ kcal: '40', slices: [{ key: 'protein', share: 1 }, { share: 0 }, { share: 0 }] });
  });
});

describe('the timeline', () => {
  it('groups the food by meal, newest first, with the meal kcal', () => {
    const d = dayWith(
      [food('f1', 1, T('06:10'), 420), food('f2', 2, T('10:30'), 165), food('f3', 2, T('13:05'), 410)],
      [
        [1, 'Meal 1', 420],
        [2, 'Meal 2', 575],
      ],
    );
    const blocks = timeline(d);
    expect(blocks.map((b) => [b.label, b.total])).toEqual([
      ['Meal 2', '575 kcal'],
      ['Meal 1', '420 kcal'],
    ]);
    expect(blocks[0]!.lines.map((l) => [l.time, l.name])).toEqual([
      ['13:05', 'f3'],
      ['10:30', 'f2'],
    ]);
  });
  it('puts the drinks after the meals and unknown times last', () => {
    const d = dayWith(
      [food('f1', 1, T('06:10'), 420), food('f2', 0, T('15:00'), 45), food('f3', 1, null, 10)],
      [
        [1, 'Meal 1', 430],
        [0, 'Drinks', 45],
      ],
    );
    const blocks = timeline(d);
    expect(blocks.map((b) => b.label)).toEqual(['Meal 1', 'Drinks']);
    expect(blocks[0]!.lines.map((l) => [l.ref, l.time])).toEqual([
      ['f1', '06:10'],
      ['f3', ''],
    ]);
  });
  it("leaves out the Health card's entries and the habit ticks, keeps the rest where it happened", () => {
    const d = dayWith(
      [
        value('e1', 'wake', T('05:40')),
        value('m1', 'weight', T('05:45'), 82.4),
        value('e2', 'meds', T('06:00')),
        food('f1', 1, T('06:10'), 420),
        value('m2', 'mood', T('09:00'), 4),
        value('e3', 'nap', T('09:30')),
        food('f2', 2, T('13:05'), 410),
      ],
      [
        [1, 'Meal 1', 420],
        [2, 'Meal 2', 410],
      ],
    );
    const blocks = timeline(d);
    expect(blocks.map((b) => b.label)).toEqual(['Meal 2', 'Other', 'Meal 1']);
    expect(blocks[1]!.lines.map((l) => [l.ref, l.value])).toEqual([
      ['e3', ''],
      ['m2', '4'],
    ]);
    expect(blocks.flatMap((b) => b.lines.map((l) => l.ref))).not.toContain('m1');
  });
  it('has every food row of the sample once, and its meal labels', () => {
    const blocks = timeline(SAMPLE);
    const foods = SAMPLE.rows.filter((r) => r.kind === 'food').map((r) => r.ref);
    const shown = blocks.flatMap((b) => b.lines.map((l) => l.ref));
    expect(shown.filter((r) => r.startsWith('f')).sort()).toEqual([...foods].sort());
    expect(blocks.map((b) => b.label)).toEqual(['Meal 2', 'Meal 1', 'Other', 'Drinks']); // the waist at 06:05, before breakfast at 06:10
    expect(blocks.find((b) => b.label === 'Other')?.lines.map((l) => [l.name, l.value])).toEqual([['Waist', '88 cm']]);
    const soup = blocks[0]!.lines.find((l) => l.name === 'Lentil soup');
    expect(soup).toMatchObject({ time: '13:05', sub: '350 g', macros: 'P 24 · F 10 · C 56 g', value: '410 kcal' });
    expect(blocks[0]!.lines.find((l) => l.name === 'Rye bread')).toMatchObject({ sub: '2 slices', macros: 'P 6 · F 1 · C 38 g' });
    // each meal's macros under its label, from energy.meals; none for "Other"
    expect(blocks.map((b) => [b.label, b.macros])).toEqual([
      ['Meal 2', 'P 37 · F 29 · C 136 g'],
      ['Meal 1', 'P 18 · F 9 · C 66 g'],
      ['Other', ''],
      ['Drinks', 'P 2 · F 2 · C 4 g'],
    ]);
    expect(blocks.find((b) => b.label === 'Other')?.lines[0]?.macros).toBe('');
  });
  it('writes macros in whole grams, halves to even as app.', () => {
    expect(macroText({ kcal: 0, protein: 2.5, fat: 3.5, carbs: 0.4 })).toBe('P 2 · F 4 · C 0 g');
  });
});

describe('the Health card', () => {
  it('has times for Bed and Woke up and values with units', () => {
    const lines = Object.fromEntries(healthLines(SAMPLE).map((h) => [h.row, h]));
    expect(lines.bed).toMatchObject({ value: '22:20', sub: 'night before' });
    expect(lines.wake).toMatchObject({ value: '05:40', sub: 'slept 7 h 20 min' });
    expect(lines.weight).toMatchObject({ value: '82.4 kg', time: '05:45' });
    expect(lines.sugar).toMatchObject({ value: '94 mg/dL', sub: 'fasted' });
    expect(lines.bp_morning).toMatchObject({ value: '118/76 mmHg', sub: 'morning' });
    expect(lines.bp_evening).toMatchObject({ value: '–', time: '' });
  });
  it('shows the last times once Bed and Woke up are for the next sleep', () => {
    const d = copy();
    const wake = d.health.find((h) => h.row === 'wake')!;
    wake.last_at = wake.at;
    wake.ref = null;
    wake.at = null;
    expect(healthLines(d).find((h) => h.row === 'wake')).toMatchObject({ value: '–', sub: 'last 05:40' });
  });
});

describe('needs you, habits, chips', () => {
  it('counts questions, messages not read, items to review and the check-in', () => {
    expect(needsCount(SAMPLE)).toBe(2 + 1 + 3 + 1);
    const d = copy();
    d.needs = { questions: [], not_read: [], review: [], checkin: null };
    expect(needsCount(d)).toBe(0);
    // "Body measurements due" counts as one (deploy 92: app. counts it with the items to review)
    d.needs.body_due = { last: '2026-10-15', days: 32 };
    expect(needsCount(d)).toBe(1);
  });
  it('names a thought by its type only', () => {
    const texts = SAMPLE.needs.review.map(reviewText);
    expect(texts.sort()).toEqual(['A task (personal)', 'Fruit bar 40 g', 'Weight 182.4 kg']);
  });
  it('counts habits done without the ones to avoid', () => {
    expect(habitsDone(SAMPLE.habits)).toBe('1/2');
    const avoid = { name: 'x', label: 'X', done: 1, target: 1, complete: true, avoid: true, last_tick: null };
    expect(habitsDone([...SAMPLE.habits, avoid])).toBe('1/2');
  });
  it('shortens chip names as app. does', () => {
    expect(chipNames(['Skyr, plain (Brand A)', 'Oats'])).toEqual(['Skyr, plain', 'Oats']);
    expect(chipNames(['Skyr (Brand A)', 'Skyr (Brand B)'])).toEqual(['Skyr (Brand A)', 'Skyr (Brand B)']);
  });
});

describe('saving in place', () => {
  it('marks the rows a save added (the blue edge), and nothing else', () => {
    const added = { ...(SAMPLE.rows.find((r) => r.kind === 'food') as FoodRow), ref: 'f999999' };
    const after: Day = { ...SAMPLE, rows: [...SAMPLE.rows, added] };
    expect([...freshRefs(SAMPLE, after)]).toEqual(['f999999']);
    expect(freshRefs(SAMPLE, SAMPLE).size).toBe(0);
    expect(freshRefs(after, SAMPLE).size).toBe(0); // an Undo takes a row away: nothing is new
  });
});
