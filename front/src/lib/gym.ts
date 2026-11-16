/**
 * The Gym's Workout page (deploy 96; the door's routes came with deploy 95): the door's Workout shape (docs/API.md, GET /gym) and
 * what the page makes of it: a row's circle (log the ready numbers, take a done one off, or set the numbers first), its words and
 * the "+2.5 kg" mark, the numbers of an opened row with app.'s steps and limits (− and +, typing), the check before a tick is sent
 * (gym.values' rules and words), the body of each save (tick, remove, pick, new), and Today's Gym card (the 14 squares, the lines).
 * Plain TypeScript, so the tests need no browser.
 */
import type { FieldValues } from './saver.js';

export type Kind = 'weights' | 'bodyweight' | 'cardio';
export const VALS = ['sets', 'reps', 'kg', 'minutes', 'km'] as const;
export type Val = (typeof VALS)[number];
export type Values = Record<Val, number | null>;

/** A logged row: "3 × 8 at 60 kg", "3 × 12", "25 min · 3.2 km". */
export interface GymSet extends Values {
  set_id: number;
  text: string;
}

export interface GymRow {
  exercise_id: number;
  name: string;
  kind: Kind;
  active: boolean;
  /** The circle is ticked: today's rows exist. */
  done: boolean;
  logged: GymSet[];
  /** The numbers the editor opens with and the circle logs. */
  values: Values;
  /** The values are complete: one tap logs them; else the row opens to set them first. */
  ready: boolean;
  text: string;
  up_kg: number | null;
  last: null | { day: string; rows: GymSet[] };
  last_text: string;
  plan: null | { item_id: number; sets: number | null; reps: number | null };
  open: boolean;
}

export interface Field {
  name: Val;
  label: string;
  step: number;
  min: number;
  max: number;
}

export interface Workout {
  today: string;
  title: string;
  started_at: string | null;
  done: number;
  status: string;
  has_split: boolean;
  day: null | { day_id: number; name: string; label: string };
  free: boolean;
  picked_by_hand: boolean;
  chips: { day_id: number | null; label: string; on: boolean }[];
  why: string | null;
  exercises: GymRow[];
  other: GymRow[];
  empty: string | null;
  hint: string | null;
  week_split: { day_id: number; label: string; exercises: string; done: string | null; today: boolean }[];
  weeks: { good: number; weeks: { start: string; label: string; n: number; days: { day: string; on: boolean; today: boolean; later: boolean }[] }[] };
  retired: string[];
  fields: Record<Kind, Field[]>;
  numbers: string;
  kinds: { key: Kind; label: string }[];
}

/** Today's Gym card (GET /day's `gym`; null for a past day). */
export interface GymCard {
  last_workout: string | null;
  day_label: string | null;
  days: { day: string; on: boolean; today: boolean }[];
  n14: number;
  last_week: number;
  this_week: number;
  text: string;
}

// ---- the parts of the Gym ------------------------------------------------------------------------------------------------------

/** The Gym's parts in the mockup's order; each is a page of this app (deploy 97; the first five opened app.'s tabs until then). */
export const PARTS = [
  { key: 'workout', label: 'Workout', href: '/gym' },
  { key: 'plan', label: 'Plan', href: '/gym/plan' },
  { key: 'progress', label: 'Progress', href: '/gym/progress' },
  { key: 'history', label: 'History', href: '/gym/history' },
  { key: 'exercises', label: 'Exercises', href: '/gym/exercises' },
  { key: 'activity', label: 'Activity', href: '/gym/activity' },
] as const;

// ---- numbers as app. writes them ---------------------------------------------------------------------------------------------

/** A number as Python's format(float(x), "g") for the gym's sizes ("67.5", "70", "0.1"); empty for none. */
export const num = (x: number | null | undefined): string => (x === null || x === undefined ? '' : String(+x));

/** One row's numbers as the owner reads them (gym.fmt). */
export function rowText(kind: Kind, v: Partial<Values>): string {
  if (kind === 'cardio') {
    return [v.minutes != null ? `${num(v.minutes)} min` : '', v.km != null ? `${num(v.km)} km` : ''].filter(Boolean).join(' · ');
  }
  const out = v.sets && v.reps ? `${v.sets} × ${v.reps}` : '';
  return out + (kind === 'weights' && v.kg != null ? ` at ${num(v.kg)} kg` : '');
}

/** The mark of a heavier day than the last session's: "+2.5 kg". */
export const upText = (up: number | null): string | null => (up === null ? null : `+${num(up)} kg`);

// ---- a row --------------------------------------------------------------------------------------------------------------------

export type Circle = 'done' | 'ready' | 'off';

/**
 * What the round button does (app.'s _row): a done one takes all of today's rows of the exercise off (remove, with Undo); a ready
 * one logs the read's numbers (tick); an "off" one (numbers not complete) opens the row instead.
 */
export const circleOf = (r: Pick<GymRow, 'done' | 'logged' | 'ready'>): Circle => (r.logged.length ? 'done' : r.ready ? 'ready' : 'off');

export function circleLabel(r: GymRow): string {
  const c = circleOf(r);
  return c === 'done' ? `Take ${r.name} off today’s workout` : c === 'ready' ? `Log ${r.name}: ${r.text}` : `${r.name}: set the numbers first`;
}

/** The circle's tick: the read's ready numbers, as they are. */
export function tickFields(r: Pick<GymRow, 'exercise_id' | 'values'>): FieldValues {
  const out: FieldValues = { exercise_id: String(r.exercise_id) };
  for (const k of VALS) if (r.values[k] !== null) out[k] = num(r.values[k]);
  return out;
}

/** A done circle: all of today's rows of the exercise off. One logged row's ×: that row. */
export const removeAllFields = (r: Pick<GymRow, 'exercise_id'>): FieldValues => ({ exercise_id: String(r.exercise_id) });
export const removeSetFields = (s: Pick<GymSet, 'set_id'>): FieldValues => ({ set_id: String(s.set_id) });

/** A chip of the day pick: a day of the split, or Free workout (no day: day_id empty). */
export const pickFields = (c: { day_id: number | null }): FieldValues => ({ day_id: c.day_id === null ? '' : String(c.day_id) });

// ---- an opened row: the numbers -------------------------------------------------------------------------------------------------

/** The opened row's numbers as typed (text, so a half-typed value is kept). */
export type Draft = Partial<Record<Val, string>>;

export const draftOf = (r: Pick<GymRow, 'values'>, fields: Field[]): Draft => Object.fromEntries(fields.map((f) => [f.name, num(r.values[f.name])]));

/** A typed number: a comma is a point (as app.); empty is none; anything else NaN. */
export function parseNum(s: string | undefined): number | null {
  const t = (s ?? '').trim().replace(',', '.');
  if (t === '') return null;
  return /^\d+(\.\d+)?$|^\.\d+$/.test(t) ? Number(t) : NaN;
}

/** − or + on a field (app.js's data-step): the step added to what is typed (0 when it is not a number), rounded to 0.01, kept in the field's limits. */
export function stepped(value: string | undefined, f: Field, dir: 1 | -1): string {
  const now = parseFloat(String(value ?? '').replace(',', '.')) || 0;
  const v = Math.round((now + dir * f.step) * 100) / 100;
  return num(Math.min(f.max, Math.max(f.min, v)));
}

/** gym.NUMBERS's limits (the core's own check: minutes from 0.1, the stepper starts at 1). */
const LIMITS: Record<Val, [number, number, boolean]> = {
  sets: [1, 50, true],
  reps: [1, 500, true],
  kg: [0, 1000, false],
  minutes: [0.1, 600, false],
  km: [0, 200, false],
};

/**
 * The check before a tick is sent, with the door's words (gym.values): a number out of range or not whole is `numbers` (the read's
 * "Numbers only: …"), then "Give the minutes.", "Give sets and reps.", "Give the weight in kg.". None when it can go.
 */
export function problem(kind: Kind, d: Draft, numbers: string): string | null {
  const names: Val[] = kind === 'cardio' ? ['minutes', 'km'] : kind === 'weights' ? ['sets', 'reps', 'kg'] : ['sets', 'reps'];
  const v: Partial<Values> = {};
  for (const k of names) {
    const x = parseNum(d[k]);
    if (x === null) continue;
    const [lo, hi, whole] = LIMITS[k];
    if (Number.isNaN(x) || x < lo || x > hi || (whole && !Number.isInteger(x))) return numbers;
    v[k] = x;
  }
  if (kind === 'cardio') return v.minutes === undefined ? 'Give the minutes.' : null;
  if (v.sets === undefined || v.reps === undefined) return 'Give sets and reps.';
  if (kind === 'weights' && v.kg === undefined) return 'Give the weight in kg.';
  return null;
}

/** The tick of an opened row: its exercise and the numbers typed (only its kind's; an empty one left out). */
export function draftFields(r: Pick<GymRow, 'exercise_id'>, fields: Field[], d: Draft): FieldValues {
  const out: FieldValues = { exercise_id: String(r.exercise_id) };
  for (const f of fields) {
    const x = parseNum(d[f.name]);
    if (x !== null && !Number.isNaN(x)) out[f.name] = num(x);
  }
  return out;
}

/** What the opened row would log, as the owner reads it ("3 × 8 at 62.5 kg"), or nothing while it is not complete. */
export function draftText(kind: Kind, fields: Field[], d: Draft): string {
  const v: Partial<Values> = {};
  for (const f of fields) {
    const x = parseNum(d[f.name]);
    if (x !== null && !Number.isNaN(x)) v[f.name] = x;
  }
  return rowText(kind, v);
}

/** The opened row's button: "Add another row" when the exercise is logged already, else "Log". */
export const logLabel = (r: Pick<GymRow, 'logged'>) => (r.logged.length ? 'Add another row' : 'Log');

// ---- + Add exercise -------------------------------------------------------------------------------------------------------------

export interface NewDraft {
  name: string;
  kind: Kind;
  words: string;
}

export const newDraft = (): NewDraft => ({ name: '', kind: 'weights', words: '' });
export const tidy = (s: string) => s.split(/\s+/).filter(Boolean).join(' ');
/** The Exercises limits of the door (docs/API.md): a name of up to 60 characters. */
export const NAME_MAX = 60;

/** The check before "Add" is sent, in the core's words. */
export function newProblem(d: NewDraft): string | null {
  const name = tidy(d.name);
  if (!name) return "Type the exercise's name.";
  if (name.length > NAME_MAX) return `The name can have up to ${NAME_MAX} characters.`;
  return null;
}

/** "+ Add exercise" from the Workout page: it also goes on today's day of the split (today). Other words: comma-separated, as app.'s form. */
export const newFields = (d: NewDraft): FieldValues => ({ name: tidy(d.name), kind: d.kind, words: d.words, today: '1' });

/** The other words typed with commas, as the door takes them: up to 10, each tidied and cut at 40 characters (gym.new_exercise). */
export const wordsOf = (s: string): string[] =>
  s
    .split(',')
    .map((w) => tidy(w).slice(0, 40))
    .filter(Boolean)
    .slice(0, 10);

// ---- the cards ------------------------------------------------------------------------------------------------------------------

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
const weekdayOf = (iso: string) => (new Date(`${iso}T12:00:00Z`).getUTCDay() + 6) % 7;
/** "Mon 16.11." */
export const dayName = (iso: string) => `${WEEKDAYS[weekdayOf(iso)]} ${iso.slice(8, 10)}.${iso.slice(5, 7)}.`;
const dm = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.`;

/** "This week's split": a day done this week says so ("Done Tue"), today's day "Today". */
export const splitNote = (x: Workout['week_split'][number]): string | null => (x.done ? `Done ${WEEKDAYS[weekdayOf(x.done)]}` : x.today ? 'Today' : null);

export const workoutsText = (n: number) => `${n} workout${n === 1 ? '' : 's'}`;
export const goodLine = (w: Workout['weeks']) => `${w.good} of 4 weeks with 2+ workouts`;
/** The hint under the list: app.'s words, but the answer bar here is below the list, not above it. */
export const hintText = (w: Pick<Workout, 'hint'>) => w.hint?.replace('Undo is in the bar above.', 'Undo is in the answer bar after a tap.') ?? null;
export const otherLabel = (w: Pick<Workout, 'other'>) => `Other exercises (${w.other.length})`;

/** The 14 squares of Today's card, oldest first: a workout, none, and today marked; the first's and the last's dates under them. */
export function squares(c: GymCard) {
  return {
    days: c.days.map((d) => ({ day: d.day, on: d.on, today: d.today, title: `${dayName(d.day)}: ${d.on ? 'workout' : 'no workout'}` })),
    from: c.days.length ? dm(c.days[0]!.day) : '',
    label: `Last 14 days: ${workoutsText(c.n14)}`,
  };
}

/** The card's lines: the last workout and today's day of the split. */
export const lastLine = (c: GymCard) => (c.last_workout ? `Last workout ${dayName(c.last_workout)}` : 'No workouts yet');
export const weekLine = (c: GymCard) => `Last week ${c.last_week} · this week ${c.this_week}`;
