/**
 * The More page's Search (deploy 108) from GET /api/v1/search?q= (docs/API.md, "More (107)"): the question, the door's five groups
 * in its order, and the link of each row into this app. Plain TypeScript, so the tests need no browser. The door never sends a
 * thought (they are words and stay at app.) and never a private or gratitude entry.
 */
import { catalogueHref } from './catalogue.js';
import { testsHref } from './medical.js';

export interface FoodRow {
  id: string;
  food_id: number;
  name: string;
}
export interface AteRow {
  id: number;
  ref: string;
  day: string;
  day_text: string;
  food: string;
  amount: number | null;
  unit: string | null;
  amount_text: string;
  note: string | null;
}
export interface WorkoutRow {
  workout_id: number;
  anchor: string;
  day: string;
  day_text: string;
  split: string;
  text: string;
}
export interface ChoreRow {
  chore_id: number;
  label: string;
  day: string;
  day_text: string;
  start: boolean;
}
export interface TestRow {
  test_id: number;
  name: string;
}

export interface Group<R> {
  title: string;
  more: boolean;
  rows: R[];
}

export interface Search {
  q: string;
  searched: boolean;
  limit: number;
  hint: string;
  foods: Group<FoodRow>;
  ate: Group<AteRow>;
  workouts: Group<WorkoutRow>;
  chores: Group<ChoreRow>;
  tests: Group<TestRow>;
}

/** What is asked: spaces squeezed and cut at 80 characters, as the door takes it. */
export const askedQ = (x: string | null | undefined): string => (x ?? '').replace(/\s+/g, ' ').trim().slice(0, 80);

/** The field's words, with the door's rule that a search needs two characters. */
export const searchable = (q: string): boolean => [...q].length >= 2;

export type GroupKey = 'foods' | 'ate' | 'workouts' | 'chores' | 'tests';
/** The groups in the door's order. */
export const GROUP_KEYS: GroupKey[] = ['foods', 'ate', 'workouts', 'chores', 'tests'];

/** The count in a group's corner: the rows, "15+" when the group is cut at the limit (`more`). */
export const countText = (g: Pick<Group<unknown>, 'rows' | 'more'>): string => `${g.rows.length}${g.more ? '+' : ''}`;

// ---- where a row leads ---------------------------------------------------------------------------------------------------------------

/** A catalogue food: Library with the search kept and the food open. */
export const foodHref = (q: string, r: Pick<FoodRow, 'food_id'>): string => catalogueHref({ q, food: r.food_id });

/** A meal: the Food day with that row open. */
export const ateHref = (r: Pick<AteRow, 'day' | 'ref'>): string => `/food?day=${encodeURIComponent(r.day)}&open=${encodeURIComponent(r.ref)}`;

/** A workout: its card on the Gym's History (the page asks the door for it, also an older one). */
export const workoutHref = (r: Pick<WorkoutRow, 'workout_id' | 'anchor'>): string => `/gym/history?w=${r.workout_id}#${r.anchor}`;

/** A chore: its own page. */
export const choreHref = (r: Pick<ChoreRow, 'chore_id'>): string => `/home/chore?id=${r.chore_id}`;

/** A lab test: Tests over time with that test open. */
export const testHref = (r: Pick<TestRow, 'test_id'>): string => testsHref({ t: r.test_id });

/** Thoughts are words: they are searched at app. only. */
export const thoughtsHref = (appUrl: string, q: string): string => `${appUrl}/web/search?q=${encodeURIComponent(q)}`;

/** The History's `w`: a workout's id, digits only; anything else is dropped (the door says 400 to it). */
export const askedWorkout = (x: string | null): string | undefined => (x !== null && /^\d{1,9}$/.test(x) ? x : undefined);
