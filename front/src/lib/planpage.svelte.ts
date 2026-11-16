/**
 * The Gym's Plan part's state in the browser (deploy 97): the read on screen (the door's Plan), the plan exercise whose numbers
 * are open and what is typed there, the "+ Add exercise", "Rename or remove" and "+ New workout day" forms, the row a save just
 * changed (blue edge) and why a form was refused (said next to that form, which keeps what was typed). The answer bar and the taps
 * on their way are the shared part (answers.svelte.ts). Every save goes to a form action of /gym/plan and its answer brings the
 * fresh Plan (view "gym_plan"). Only taking an exercise off a day has Undo; none of these saves takes a key and none is ever sent
 * again by the page (saver.ts).
 */
import { getContext, setContext } from 'svelte';
import { Answers } from './answers.svelte.js';
import type { SaveAnswer, Undo } from './day.js';
import {
  addDraft,
  addProblem,
  dayactiveFields,
  dayeditFields,
  dayProblem,
  daynewFields,
  itemaddFields,
  itemmoveFields,
  itemremoveFields,
  itemsetFields,
  numbersOf,
  numbersProblem,
  planFormOf,
  type AddDraft,
  type Numbers,
  type Plan,
  type PlanDay,
  type PlanItem,
} from './gymplan.js';
import type { FieldValues } from './saver.js';

export class PlanPage extends Answers {
  plan = $state.raw<Plan | null>(null);
  /** The plan exercise whose numbers are open (one at a time), and what is typed there. */
  open = $state<number | null>(null);
  numbers = $state<Record<number, Numbers>>({});
  /** The day whose "+ Add exercise" form is open, and its draft. */
  adding = $state<number | null>(null);
  addOne = $state<AddDraft>({ exercise_id: '', sets: '', reps: '' });
  /** The day whose "Rename or remove" is open, and the name typed. */
  editing = $state<number | null>(null);
  editName = $state('');
  /** "+ New workout day": open (it starts open without a day), the name typed. */
  newOpen = $state(false);
  newName = $state('');
  /** The plan exercise or day a save just changed (blue edge). */
  changed = $state<number | null>(null);
  changedDay = $state<number | null>(null);
  /** Why a form was refused, by form ("item:7", "add:2", "edit:2", "new"): next to it. */
  errs = $state<Record<string, string>>({});

  #loaded: Plan | null = null;

  constructor(plan: Plan | null, undo: Undo | null) {
    super('/gym/plan');
    this.load(plan, undo);
  }

  /** The page's load (a visit, a reload), with the session's Undo. */
  load(plan: Plan | null, undo: Undo | null) {
    if (plan === this.#loaded) return;
    this.#loaded = plan;
    this.plan = plan;
    this.changed = this.changedDay = null;
    this.newOpen = plan ? plan.days.length === 0 : false;
    this.loadUndo(undo);
  }

  // ---- a plan exercise ---------------------------------------------------------------------------------------------------------

  /** The name tapped: its numbers open (another closes), or close. */
  toggle(item: PlanItem) {
    if (this.open === item.item_id) {
      this.open = null;
      return;
    }
    this.open = item.item_id;
    this.numbers[item.item_id] = numbersOf(item);
    delete this.errs[`item:${item.item_id}`];
  }

  async saveNumbers(item: PlanItem) {
    const n = this.numbers[item.item_id];
    if (!n || !this.plan) return;
    const stop = numbersProblem(n, this.plan.limits);
    if (stop) {
      this.errs[`item:${item.item_id}`] = stop;
      return;
    }
    delete this.errs[`item:${item.item_id}`];
    await this.tap('gym_itemset', `item:${item.item_id}`, itemsetFields(item, n));
  }

  async move(item: PlanItem, dir: 'up' | 'down') {
    await this.tap('gym_itemmove', `move:${item.item_id}`, itemmoveFields(item, dir));
  }

  async remove(item: PlanItem) {
    await this.tap('gym_itemremove', `rm:${item.item_id}`, itemremoveFields(item));
  }

  // ---- "+ Add exercise" on a day -----------------------------------------------------------------------------------------------

  startAdd(day: PlanDay) {
    delete this.errs[`add:${day.day_id}`];
    this.addOne = addDraft(day);
    this.adding = day.day_id;
  }

  closeAdd() {
    if (this.adding !== null) delete this.errs[`add:${this.adding}`];
    this.adding = null;
  }

  async addItem(day: PlanDay) {
    if (!this.plan) return;
    const stop = addProblem(this.addOne, this.plan.limits);
    if (stop) {
      this.errs[`add:${day.day_id}`] = stop;
      return;
    }
    delete this.errs[`add:${day.day_id}`];
    await this.tap('gym_itemadd', `add:${day.day_id}`, itemaddFields(day, this.addOne));
  }

  // ---- "Rename or remove" and the days -----------------------------------------------------------------------------------------

  startEdit(day: PlanDay) {
    delete this.errs[`edit:${day.day_id}`];
    this.editName = day.name;
    this.editing = day.day_id;
  }

  closeEdit() {
    if (this.editing !== null) delete this.errs[`edit:${this.editing}`];
    this.editing = null;
  }

  async rename(day: PlanDay) {
    const stop = dayProblem(this.editName);
    if (stop) {
      this.errs[`edit:${day.day_id}`] = stop;
      return;
    }
    delete this.errs[`edit:${day.day_id}`];
    await this.tap('gym_dayedit', `edit:${day.day_id}`, dayeditFields(day, this.editName));
  }

  async removeDay(day: PlanDay) {
    await this.tap('gym_dayactive', `day:${day.day_id}`, dayactiveFields(day, false));
  }

  async bringBack(x: { day_id: number }) {
    await this.tap('gym_dayactive', `day:${x.day_id}`, dayactiveFields(x, true));
  }

  async addDay() {
    const stop = dayProblem(this.newName, true);
    if (stop) {
      this.errs.new = stop;
      return;
    }
    delete this.errs.new;
    await this.tap('gym_daynew', 'new', daynewFields(this.newName));
  }

  // ---- the saves ---------------------------------------------------------------------------------------------------------------

  /** Every save asks for the Plan read. */
  protected extra(_action: string): FieldValues {
    return { view: 'gym_plan' };
  }

  /** A refusal of a form goes next to that form, which keeps what was typed; a move or a take-off says it in the answer bar. */
  protected inlineRefusal(action: string) {
    return ['gym_itemset', 'gym_itemadd', 'gym_dayedit', 'gym_daynew'].includes(action);
  }

  /** The fresh Plan onto the screen; a row or day a save changed gets the blue edge, the form of a save that went closes. */
  protected take(a: SaveAnswer, action: string, fields: FieldValues) {
    const before = this.plan;
    const after = a.gym_plan;
    if (after) {
      this.plan = after;
      this.#loaded = after;
    }
    const form = planFormOf(action, fields);
    if (!['saved', 'changed', 'partly_saved'].includes(a.outcome)) {
      if (form) this.errs[form] = a.reason ?? a.head;
      return;
    }
    if (form) delete this.errs[form];
    this.changed = this.changedDay = null;
    const id = Number(fields.item_id);
    const dayId = Number(fields.day_id);
    if (action === 'gym_itemset') {
      this.open = null;
      this.changed = id;
    } else if (action === 'gym_itemmove') {
      this.changed = id;
    } else if (action === 'gym_itemadd') {
      const had = new Set(before?.days.find((d) => d.day_id === dayId)?.items.map((i) => i.item_id));
      this.changed = after?.days.find((d) => d.day_id === dayId)?.items.find((i) => !had.has(i.item_id))?.item_id ?? null;
      this.adding = null;
    } else if (action === 'gym_dayedit') {
      this.editing = null;
      this.changedDay = dayId;
    } else if (action === 'gym_dayactive') {
      this.editing = null;
      this.changedDay = after?.days.some((d) => d.day_id === dayId) ? dayId : null;
    } else if (action === 'gym_daynew') {
      const had = new Set(before?.days.map((d) => d.day_id));
      this.changedDay = after?.days.find((d) => !had.has(d.day_id))?.day_id ?? null;
      this.newName = '';
      this.newOpen = false;
    }
    // what is gone from the read closes: an exercise taken off, a day removed
    if (this.plan) {
      const items = new Set(this.plan.days.flatMap((d) => d.items.map((i) => i.item_id)));
      if (this.open !== null && !items.has(this.open)) this.open = null;
      if (this.adding !== null && !this.plan.days.some((d) => d.day_id === this.adding)) this.adding = null;
      if (this.editing !== null && !this.plan.days.some((d) => d.day_id === this.editing)) this.editing = null;
      if (this.plan.days.length === 0) this.newOpen = true;
    }
  }
}

const KEY = Symbol('plan-page');
export const setPlanPage = (p: PlanPage) => setContext(KEY, p);
export const getPlanPage = () => getContext<PlanPage>(KEY);
