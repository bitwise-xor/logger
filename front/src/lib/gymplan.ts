/**
 * The Gym's Plan and Exercises parts (deploy 97): the door's Plan and Exercises shapes (docs/API.md, GET /gym/plan and
 * /gym/exercises) and what the pages make of them: a plan exercise's line and its sets × reps form, up and down, remove, "+ Add
 * exercise" on a day, "Rename or remove" and "+ New workout day", an exercise's Rename, Retire and "+ New exercise". The checks
 * before a save is sent use the door's own words (gym._plan_numbers, day_new, rename, new_exercise); the door checks again. The
 * body of each save is the form's fields as the page sends them (src/lib/server/saves.ts turns them into the door's JSON).
 * Plain TypeScript, so the tests need no browser.
 */
import type { FieldValues } from './saver.js';
import { dayName as dateName, NAME_MAX, num, tidy, type Kind } from './gym.js';

// ---- the Plan ---------------------------------------------------------------------------------------------------------------------

export interface PlanItem {
  item_id: number;
  exercise_id: number;
  name: string;
  kind: Kind;
  active: boolean;
  sets: number | null;
  reps: number | null;
  /** "Weights · plan 3 × 10", "Bodyweight", "Machine cardio", "… · retired". */
  text: string;
}

export interface PlanDay {
  day_id: number;
  name: string;
  label: string;
  today: boolean;
  items: PlanItem[];
  /** The active exercises not on this day ("+ Add exercise"). */
  can_add: { exercise_id: number; name: string }[];
}

export interface Plan {
  today: string;
  how: string;
  week: string | null;
  done: { day_id: number; label: string; day: string }[];
  day: null | { day_id: number; name: string; label: string };
  free: boolean;
  days: PlanDay[];
  removed: { day_id: number; name: string }[];
  limits: { name_max: number; sets_min: number; sets_max: number; reps_min: number; reps_max: number };
}

/** The day's name limit when the read has none (gym.day_new cuts at 40). */
export const DAY_NAME_MAX = 40;

/** The tag of a day's card: "Today" on today's day, else "3 exercises". */
export const dayTag = (d: Pick<PlanDay, 'today' | 'items'>): string =>
  d.today ? 'Today' : `${d.items.length} exercise${d.items.length === 1 ? '' : 's'}`;

/** A day done this week as a chip: "Day 1 · Push · done Mon 16.11.". */
export const doneChip = (d: Plan['done'][number]): string => `${d.label} · done ${dateName(d.day)}`;

/** The line a cardio exercise shows in place of the numbers form (gympage._plan_day). */
export const CARDIO_NOTE = 'Cardio: you set the minutes when you log it.';

/** Whether the numbers form is offered: not for cardio (the minutes are set when it is logged). */
export const hasNumbers = (i: Pick<PlanItem, 'kind'>): boolean => i.kind !== 'cardio';

/** The first exercise of a day cannot go up, the last cannot go down. */
export const canMove = (d: Pick<PlanDay, 'items'>, index: number, dir: 'up' | 'down'): boolean =>
  dir === 'up' ? index > 0 : index < d.items.length - 1;

/** The numbers of a plan form as typed (text, so a half-typed value stays). */
export interface Numbers {
  sets: string;
  reps: string;
}

export const numbersOf = (i: Pick<PlanItem, 'sets' | 'reps'>): Numbers => ({ sets: num(i.sets), reps: num(i.reps) });

/** A typed whole number: empty is none, anything that is not a whole number is NaN. */
function whole(s: string): number | null {
  const t = s.trim();
  if (t === '') return null;
  return /^\d+$/.test(t) ? Number(t) : Number.NaN;
}

/** "Numbers only: sets 1 to 50, reps 1 to 500." from the read's limits. */
export const numbersWords = (l: Plan['limits']): string => `Numbers only: sets ${l.sets_min} to ${l.sets_max}, reps ${l.reps_min} to ${l.reps_max}.`;

/**
 * The check before a plan form is sent (gym._plan_numbers): both numbers whole and in range, or both empty. The door's words;
 * null when it can go.
 */
export function numbersProblem(n: Numbers, l: Plan['limits']): string | null {
  const [sets, reps] = [whole(n.sets), whole(n.reps)];
  if ((sets !== null && (Number.isNaN(sets) || sets < l.sets_min || sets > l.sets_max)) || (reps !== null && (Number.isNaN(reps) || reps < l.reps_min || reps > l.reps_max))) {
    return numbersWords(l);
  }
  return (sets === null) !== (reps === null) ? 'Give both sets and reps, or neither.' : null;
}

/** The numbers as fields: both left out when empty (no plan numbers). */
const numberFields = (n: Numbers): FieldValues => {
  const out: FieldValues = {};
  if (n.sets.trim() !== '') out.sets = n.sets.trim();
  if (n.reps.trim() !== '') out.reps = n.reps.trim();
  return out;
};

/** A plan exercise's form: its sets and reps (both empty: no plan numbers). */
export const itemsetFields = (item: Pick<PlanItem, 'item_id'>, n: Numbers): FieldValues => ({ item_id: String(item.item_id), ...numberFields(n) });

/** Up or down on its day. */
export const itemmoveFields = (item: Pick<PlanItem, 'item_id'>, dir: 'up' | 'down'): FieldValues => ({ item_id: String(item.item_id), dir });

/** Take it off the day (Undo puts it back). */
export const itemremoveFields = (item: Pick<PlanItem, 'item_id'>): FieldValues => ({ item_id: String(item.item_id) });

/** "+ Add exercise" on a day: the exercise chosen and the optional sets and reps. */
export interface AddDraft {
  exercise_id: string;
  sets: string;
  reps: string;
}

/** The form starts on the first exercise the read allows. */
export const addDraft = (d: Pick<PlanDay, 'can_add'>): AddDraft => ({ exercise_id: d.can_add[0] ? String(d.can_add[0].exercise_id) : '', sets: '', reps: '' });

export function addProblem(a: AddDraft, l: Plan['limits']): string | null {
  if (!a.exercise_id) return 'Pick a day and one of your exercises.';
  return numbersProblem(a, l);
}

export const itemaddFields = (day: Pick<PlanDay, 'day_id'>, a: AddDraft): FieldValues => ({
  day_id: String(day.day_id),
  exercise_id: a.exercise_id,
  ...numberFields(a),
});

/** A day's name as the door wants it: spaces tidied, up to 40 characters. */
export const dayName = (s: string): string => tidy(s).slice(0, DAY_NAME_MAX);

/** The check before "Rename" or "Add day" is sent, in the core's words (gym.day_edit, gym.day_new). */
export const dayProblem = (s: string, fresh = false): string | null =>
  dayName(s) === '' ? (fresh ? "Type the day's name, e.g. Push." : "Type the day's name.") : null;

export const daynewFields = (name: string): FieldValues => ({ name: dayName(name) });
export const dayeditFields = (day: Pick<PlanDay, 'day_id'>, name: string): FieldValues => ({ day_id: String(day.day_id), name: dayName(name) });
/** Remove a day (on false) or bring it back (on true). */
export const dayactiveFields = (day: { day_id: number }, on: boolean): FieldValues => ({ day_id: String(day.day_id), on: on ? '1' : '0' });

/** The id a refusal of a plan form is shown by: the form it came from ("item:7", "add:2", "edit:2", "new"). */
export function planFormOf(action: string, fields: FieldValues): string | null {
  switch (action) {
    case 'gym_itemset':
      return `item:${fields.item_id}`;
    case 'gym_itemadd':
      return `add:${fields.day_id}`;
    case 'gym_dayedit':
      return `edit:${fields.day_id}`;
    case 'gym_daynew':
      return 'new';
    default:
      return null;
  }
}

// ---- the Exercises ----------------------------------------------------------------------------------------------------------------

export interface ExerciseRow {
  exercise_id: number;
  name: string;
  kind: Kind;
  kind_label: string;
  words: string[];
  active: boolean;
  workouts: number;
  last_day: string | null;
  /** "12 workouts, last 04.11." or "not done yet". */
  use: string;
  /** The whole line under the name: "Weights · also: bench · 12 workouts, last 04.11.". */
  meta: string;
}

export interface Exercises {
  active: number;
  exercises: ExerciseRow[];
  kinds: { key: Kind; label: string }[];
  limits: { name_max: number; words_max: number; word_max: number };
}

/** "8 active". */
export const activeLine = (e: Pick<Exercises, 'active'>): string => `${e.active} active`;

/** The check before Rename or "Add" is sent (gym.rename, gym.new_exercise): a name, up to 60 characters. */
export function exerciseNameProblem(s: string, max = NAME_MAX): string | null {
  const name = tidy(s);
  if (!name) return "Type the exercise's name.";
  return name.length > max ? `The name can have up to ${max} characters.` : null;
}

/** Rename: the exercise and its new name. */
export const renameFields = (x: Pick<ExerciseRow, 'exercise_id'>, name: string): FieldValues => ({ exercise_id: String(x.exercise_id), name: tidy(name) });

/** Retire (an active one) or Bring back (a retired one): the button says what it does. */
export const activeFields = (x: Pick<ExerciseRow, 'exercise_id' | 'active'>): FieldValues => ({ exercise_id: String(x.exercise_id), on: x.active ? '0' : '1' });
export const activeLabel = (x: Pick<ExerciseRow, 'active'>): string => (x.active ? 'Retire' : 'Bring back');

/** "+ New exercise" (the Exercises part): not put on today's day, unlike the Workout page's form. */
export function newExerciseFields(d: { name: string; kind: Kind; words: string }): FieldValues {
  return { name: tidy(d.name), kind: d.kind, words: d.words };
}

/** The id a refusal of an Exercises form is shown by: "rename:7" or "new". */
export function exerciseFormOf(action: string, fields: FieldValues): string | null {
  return action === 'gym_rename' ? `rename:${fields.exercise_id}` : action === 'gym_new' ? 'new' : null;
}
