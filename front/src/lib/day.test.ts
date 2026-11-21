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
  gratitudeShown,
  hiddenReviewText,
  needsCount,
  reviewShown,
  changeLink,
  reviewText,
  timeline,
  rowCols,
  mealCols,
  amountOf,
  daysAgo,
  todayDayLinks,
  todayHref,
  type Day,
  type FoodRow,
  type Review,
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
    expect(blocks.map((b) => [b.label, b.cols?.kcal])).toEqual([
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
    // deploy 117: a food is one line, its amount after its name, its numbers in the four columns (protein, fat, carbs, kcal)
    const soup = blocks[0]!.lines.find((l) => l.name === 'Lentil soup');
    expect(soup).toMatchObject({ time: '13:05', amount: '350 g', sub: '', cols: { protein: '24', fat: '10', carbs: '56', kcal: '410' }, value: '410 kcal' });
    expect(soup?.row?.ref).toBe(soup?.ref);
    // the portion's words stay (they were the second line), after the amount, as on the Food day
    expect(blocks[0]!.lines.find((l) => l.name === 'Rye bread')).toMatchObject({ amount: '80 g (2 slices)', cols: { protein: '6', fat: '1', carbs: '38' } });
    // each meal's totals in the same four columns, each with its letter, from energy.meals; none for "Other"
    expect(blocks.map((b) => [b.label, b.cols && Object.values(b.cols)])).toEqual([
      ['Meal 2', ['P 37', 'F 29', 'C 136', '934 kcal']],
      ['Meal 1', ['P 18', 'F 9', 'C 66', '420 kcal']],
      ['Other', null],
      ['Drinks', ['P 2', 'F 2', 'C 4', '45 kcal']],
    ]);
    // a row that is not food keeps its look: name, small line, value; no columns, no amount, no editor
    expect(blocks.find((b) => b.label === 'Other')?.lines[0]).toMatchObject({ amount: '', cols: null, row: null, value: '88 cm' });
  });
  it('writes a food\'s numbers in whole grams and kcal, grouped, and an amount with a decimal as typed', () => {
    expect(rowCols({ kcal: 1234.5, protein: 102.5, fat: 0.4, carbs: 3.5 })).toEqual({ protein: '102', fat: '0', carbs: '4', kcal: '1,234' });
    expect(mealCols({ kcal: 2100, protein: 32, fat: 14, carbs: 60 })).toEqual({ protein: 'P 32', fat: 'F 14', carbs: 'C 60', kcal: '2,100 kcal' });
    expect(amountOf({ amount: 12.5, unit: 'g', portion_text: null })).toBe('12.5 g');
    expect(amountOf({ amount: 1250, unit: 'ml', portion_text: '5 glasses' })).toBe('1,250 ml (5 glasses)');
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
  it('follows Settings\' two switches (deploy 111): a hidden To review box counts as its one line, a hidden Gratitude card goes', () => {
    expect(SAMPLE.shown).toEqual({ review: true, gratitude: true });
    expect([reviewShown(SAMPLE), gratitudeShown(SAMPLE)]).toEqual([true, true]);
    const d = copy();
    d.shown = { review: false, gratitude: false };
    expect([reviewShown(d), gratitudeShown(d)]).toEqual([false, false]);
    expect(needsCount(d)).toBe(2 + 1 + 1 + 1);
    d.needs.review = [];
    expect(needsCount(d)).toBe(2 + 1 + 0 + 1);
    // an older door without `shown`: both as before
    delete d.shown;
    expect([reviewShown(d), gratitudeShown(d)]).toEqual([true, true]);
    expect([hiddenReviewText(1), hiddenReviewText(3)]).toEqual(['1 item to review is hidden here', '3 items to review are hidden here']);
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

describe('where Change on a To review row leads (deploy 113)', () => {
  const APP = 'https://old.example';
  const OLD = { href: `${APP}/web/`, app: true };
  const byRef = (ref: string) => SAMPLE.needs.review.find((r) => r.ref === ref) as Review;
  const [thought, foodRow, weight] = [byRef('t1'), byRef('f5'), byRef('m5')];
  const row = (over: Partial<Review>): Review => ({ ...foodRow, ...over });

  it('opens a food on its day with the entry open', () => {
    expect(changeLink(foodRow, APP)).toEqual({ href: '/food?day=2026-11-16&open=f5', app: false });
  });
  it('sends a weight, pressure or sugar to Health, a tape measure to its day in the body form', () => {
    expect(changeLink(weight, APP)).toEqual({ href: '/health', app: false });
    for (const type of ['bp', 'blood_sugar']) expect(changeLink(row({ kind: 'measurement', ref: 'm9', type }), APP).href).toBe('/health');
    expect(changeLink(row({ kind: 'measurement', ref: 'm9', type: null }), APP).href).toBe('/health');
    for (const type of ['waist', 'hips', 'chest', 'upper_arm', 'thigh']) {
      expect(changeLink(row({ kind: 'measurement', ref: 'm9', type, day: '2026-11-12' }), APP)).toEqual({ href: '/health?measure=1&mday=2026-11-12#body', app: false });
    }
  });
  it('keeps thoughts and events at the old app, with the tag', () => {
    expect(changeLink(thought, APP)).toEqual(OLD);
    expect(changeLink(row({ kind: 'event', ref: 'e2', type: null, label: 'Wake-up' }), APP)).toEqual(OLD);
    expect(changeLink(row({ kind: 'event', ref: 'e2', type: 'wake' }), APP)).toEqual(OLD);
  });
  it('falls back to the old app for odd input', () => {
    expect(changeLink(row({ ref: 'm5' }), APP)).toEqual(OLD); // a food with a measurement's ref
    expect(changeLink(row({ kind: 'measurement', ref: 'f5' }), APP)).toEqual(OLD);
    expect(changeLink(row({ ref: 'f5/../x' }), APP)).toEqual(OLD);
    expect(changeLink(row({ ref: 'f' }), APP)).toEqual(OLD);
    expect(changeLink(row({ ref: 'f1234567890' }), APP)).toEqual(OLD);
    expect(changeLink(row({ day: '' }), APP)).toEqual(OLD);
    expect(changeLink(row({ day: '16.11.2026' }), APP)).toEqual(OLD);
    expect(changeLink(row({ day: undefined as unknown as string }), APP)).toEqual(OLD);
    expect(changeLink(row({ kind: 'measurement', ref: 'm5', type: 'waist', day: 'x&open=1' }), APP)).toEqual(OLD);
    expect(changeLink(row({ kind: 'gratitude' as Review['kind'], ref: 'g1' }), APP)).toEqual(OLD);
  });
});

describe('Today for an earlier day (Web 69)', () => {
  it('leads to / for today and /?day= for another day', () => {
    expect(todayHref('2026-11-21', '2026-11-21')).toBe('/');
    expect(todayHref('2026-11-19', '2026-11-21')).toBe('/?day=2026-11-19');
    expect(todayHref('2026-11-19')).toBe('/?day=2026-11-19');
  });
  it("has ‹ always and › only from an earlier day; the day after yesterday is /", () => {
    expect(todayDayLinks({ day: '2026-11-21', today: '2026-11-21', past: false })).toEqual({ before: '/?day=2026-11-20', after: null });
    expect(todayDayLinks({ day: '2026-11-20', today: '2026-11-21', past: true })).toEqual({ before: '/?day=2026-11-19', after: '/' });
    expect(todayDayLinks({ day: '2026-10-31', today: '2026-11-21', past: true })).toEqual({ before: '/?day=2026-10-30', after: '/?day=2026-11-01' });
  });
  it("says how long ago, as app.'s kicker", () => {
    expect(daysAgo({ day: '2026-11-21', today: '2026-11-21' })).toBe('Today');
    expect(daysAgo({ day: '2026-11-20', today: '2026-11-21' })).toBe('Yesterday');
    expect(daysAgo({ day: '2026-11-14', today: '2026-11-21' })).toBe('7 days ago');
    expect(daysAgo({ day: '2026-03-28', today: '2026-03-30' })).toBe('2 days ago'); // over the clock change
  });
  it('leaves the items to review out of Needs you on an earlier day (app. shows none there)', () => {
    const d = copy();
    d.needs = { questions: [], not_read: [], review: SAMPLE.needs.review, checkin: null };
    expect(needsCount(d)).toBe(SAMPLE.needs.review.length);
    d.past = true;
    expect(needsCount(d)).toBe(0);
  });
});
