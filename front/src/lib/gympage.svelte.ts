/**
 * The Gym's Workout page's state in the browser (deploy 96): the read on screen (the door's Workout), the row opened to change its
 * numbers and what is typed there, "Other exercises" open or not, the "+ Add exercise" form, the row a tick just logged (blue
 * edge), and why the add form was refused. The answer bar and the taps on their way are the shared part (answers.svelte.ts).
 * Every save goes to a form action of /gym (gym_tick, gym_remove, gym_pick, gym_new, undo) and its answer brings the fresh Workout
 * (view "gym"). A tick and a remove have Undo in the answer bar; the day pick and a new exercise have none (docs/API.md).
 */
import { getContext, setContext } from 'svelte';
import { Answers } from './answers.svelte.js';
import type { SaveAnswer, Undo } from './day.js';
import {
  circleOf,
  draftFields,
  draftOf,
  newDraft,
  newFields,
  newProblem,
  pickFields,
  problem,
  removeAllFields,
  removeSetFields,
  stepped,
  tickFields,
  tidy,
  type Draft,
  type Field,
  type GymRow,
  type GymSet,
  type NewDraft,
  type Workout,
} from './gym.js';
import type { FieldValues } from './saver.js';

export class GymPage extends Answers {
  workout = $state.raw<Workout | null>(null);
  /** The row opened to change its numbers (one at a time), and what is typed there. */
  open = $state<number | null>(null);
  draft = $state<Draft>({});
  /** "Other exercises (n)" opened. */
  otherOpen = $state(false);
  adding = $state(false);
  newOne = $state<NewDraft>(newDraft());
  /** The row a save just logged or added (blue edge). */
  changed = $state<number | null>(null);
  /** Why the add form was refused (next to it; it keeps the words). */
  err = $state<string | null>(null);

  #loaded: Workout | null = null;

  constructor(workout: Workout | null, undo: Undo | null) {
    super('/gym');
    this.load(workout, undo);
  }

  /** The page's load (a visit, a reload), with the session's Undo. The read's own "open" row starts opened (app.'s first new one). */
  load(workout: Workout | null, undo: Undo | null) {
    if (workout === this.#loaded) return;
    this.#loaded = workout;
    this.workout = workout;
    this.changed = null;
    const first = workout?.exercises.find((r) => r.open) ?? null;
    if (first) this.#openRow(first);
    else this.open = null;
    this.loadUndo(undo);
  }

  fields(r: Pick<GymRow, 'kind'>): Field[] {
    return this.workout?.fields[r.kind] ?? [];
  }

  #openRow(r: GymRow) {
    this.open = r.exercise_id;
    this.draft = draftOf(r, this.fields(r));
  }

  /** A row's name tapped: it opens with the read's numbers (another one closes), or closes when it was open. */
  toggle(r: GymRow) {
    if (this.open === r.exercise_id) this.open = null;
    else this.#openRow(r);
  }

  /** The round button: a done one takes today's rows off, a ready one logs the read's numbers, an "off" one opens the row. */
  async circle(r: GymRow) {
    const c = circleOf(r);
    if (c === 'off') {
      if (this.open !== r.exercise_id) this.#openRow(r);
      return;
    }
    if (c === 'done') await this.tap('gym_remove', `circle:${r.exercise_id}`, removeAllFields(r));
    else await this.tap('gym_tick', `circle:${r.exercise_id}`, tickFields(r));
  }

  /** − or + on a field of the opened row. */
  step(f: Field, dir: 1 | -1) {
    this.draft[f.name] = stepped(this.draft[f.name], f, dir);
  }

  /** "Log" or "Add another row": the numbers typed, checked first in the door's words (a refusal says why in the answer bar). */
  async log(r: GymRow) {
    const w = this.workout;
    if (!w) return;
    const fields = this.fields(r);
    const stop = problem(r.kind, this.draft, w.numbers);
    if (stop) {
      this.show({ tone: 'warning', head: 'Nothing saved.', lines: [stop], undo: null, confirm: null });
      return;
    }
    await this.tap('gym_tick', `log:${r.exercise_id}`, draftFields(r, fields, this.draft));
  }

  /** The × of one logged row. */
  async removeSet(s: GymSet) {
    await this.tap('gym_remove', `set:${s.set_id}`, removeSetFields(s));
  }

  /** A chip of the day pick: today's list becomes that day's (or every exercise, Free workout). */
  async pick(c: Workout['chips'][number]) {
    if (c.on) return;
    await this.tap('gym_pick', 'pick', pickFields(c));
  }

  startAdd() {
    this.err = null;
    this.adding = true;
  }

  closeAdd() {
    this.err = null;
    this.adding = false;
  }

  async addNew() {
    const stop = newProblem(this.newOne);
    if (stop) {
      this.err = stop;
      return;
    }
    this.err = null;
    await this.tap('gym_new', 'new', newFields(this.newOne));
  }

  // ---- the saves -------------------------------------------------------------------------------------------------------------

  /** Every save asks for the Workout read. */
  protected extra(_action: string): FieldValues {
    return { view: 'gym' };
  }

  /** A refusal of "+ Add exercise" goes next to its form, which keeps the words; the others go in the answer bar. */
  protected inlineRefusal(action: string) {
    return action === 'gym_new';
  }

  /**
   * The fresh Workout onto the screen. A tick that went through: its row gets a blue edge and closes. A pick: the opened row closes
   * (the list is another day's). A new exercise: the form closes and empties, and the new row gets a blue edge.
   */
  protected take(a: SaveAnswer, action: string, fields: FieldValues) {
    const went = ['saved', 'changed', 'partly_saved'].includes(a.outcome);
    const before = this.workout;
    const after = a.gym;
    if (after) {
      this.workout = after;
      this.#loaded = after;
    }
    if (!went) {
      if (action === 'gym_new') this.err = a.reason ?? a.head;
      return;
    }
    const all = (w: Workout | null) => (w ? [...w.exercises, ...w.other] : []);
    if (action === 'gym_tick') {
      this.changed = Number(fields.exercise_id);
      if (this.open === this.changed) this.open = null;
    } else if (action === 'gym_pick') {
      this.changed = null;
      this.open = null;
    } else if (action === 'gym_new') {
      const had = new Set(all(before).map((r) => r.exercise_id));
      const name = tidy(String(fields.name ?? '')).toLowerCase();
      this.changed = all(after ?? null).find((r) => !had.has(r.exercise_id) || r.name.toLowerCase() === name)?.exercise_id ?? null;
      this.adding = false;
      this.err = null;
      this.newOne = newDraft();
    } else {
      this.changed = null;
    }
    // a row that is gone from the read closes
    if (this.open !== null && !all(this.workout).some((r) => r.exercise_id === this.open)) this.open = null;
  }
}

const KEY = Symbol('gym-page');
export const setGymPage = (p: GymPage) => setContext(KEY, p);
export const getGymPage = () => getContext<GymPage>(KEY);
