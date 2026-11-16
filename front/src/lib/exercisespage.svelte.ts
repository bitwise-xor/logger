/**
 * The Gym's Exercises part's state in the browser (deploy 97): the read on screen (the door's Exercises), the exercise being
 * renamed and the name typed, "+ New exercise" (open while the list is empty) and what is typed there, the row a save just changed
 * (blue edge) and why a form was refused (next to it; it keeps what was typed). Every save goes to a form action of /gym/exercises
 * and its answer brings the fresh Exercises read (view "gym_exercises"). None has Undo and none takes a key; none is ever sent
 * again by the page (saver.ts).
 */
import { getContext, setContext } from 'svelte';
import { Answers } from './answers.svelte.js';
import type { SaveAnswer, Undo } from './day.js';
import { newDraft, tidy, type NewDraft } from './gym.js';
import { activeFields, exerciseFormOf, exerciseNameProblem, newExerciseFields, renameFields, type ExerciseRow, type Exercises } from './gymplan.js';
import type { FieldValues } from './saver.js';

export class ExercisesPage extends Answers {
  exercises = $state.raw<Exercises | null>(null);
  /** The exercise being renamed (one at a time) and the name typed. */
  renaming = $state<number | null>(null);
  renameText = $state('');
  adding = $state(false);
  newOne = $state<NewDraft>(newDraft());
  /** The row a save just changed or added (blue edge). */
  changed = $state<number | null>(null);
  /** Why a form was refused ("rename:7", "new"): next to it. */
  errs = $state<Record<string, string>>({});

  #loaded: Exercises | null = null;

  constructor(exercises: Exercises | null) {
    super('/gym/exercises');
    this.load(exercises);
  }

  /** The page's load: the list; "+ New exercise" starts open when the list is empty. (No Undo is offered here.) */
  load(exercises: Exercises | null) {
    if (exercises === this.#loaded) return;
    this.#loaded = exercises;
    this.exercises = exercises;
    this.changed = null;
    this.adding = !!exercises && exercises.exercises.length === 0;
    this.loadUndo(null);
  }

  startRename(x: ExerciseRow) {
    delete this.errs[`rename:${x.exercise_id}`];
    this.renameText = x.name;
    this.renaming = x.exercise_id;
  }

  closeRename() {
    if (this.renaming !== null) delete this.errs[`rename:${this.renaming}`];
    this.renaming = null;
  }

  async rename(x: ExerciseRow) {
    const stop = exerciseNameProblem(this.renameText, this.exercises?.limits.name_max);
    if (stop) {
      this.errs[`rename:${x.exercise_id}`] = stop;
      return;
    }
    delete this.errs[`rename:${x.exercise_id}`];
    await this.tap('gym_rename', `rename:${x.exercise_id}`, renameFields(x, this.renameText));
  }

  /** Retire or Bring back. */
  async toggleActive(x: ExerciseRow) {
    await this.tap('gym_active', `active:${x.exercise_id}`, activeFields(x));
  }

  startAdd() {
    delete this.errs.new;
    this.adding = true;
  }

  closeAdd() {
    delete this.errs.new;
    this.adding = false;
  }

  async addNew() {
    const stop = exerciseNameProblem(this.newOne.name, this.exercises?.limits.name_max);
    if (stop) {
      this.errs.new = stop;
      return;
    }
    delete this.errs.new;
    await this.tap('gym_new', 'new', newExerciseFields(this.newOne));
  }

  // ---- the saves ---------------------------------------------------------------------------------------------------------------

  protected extra(_action: string): FieldValues {
    return { view: 'gym_exercises' };
  }

  /** A refusal of Rename or + New exercise goes next to its form; Retire and Bring back say it in the answer bar. */
  protected inlineRefusal(action: string) {
    return action === 'gym_rename' || action === 'gym_new';
  }

  protected take(a: SaveAnswer, action: string, fields: FieldValues) {
    const before = this.exercises;
    const after = a.gym_exercises;
    if (after) {
      this.exercises = after;
      this.#loaded = after;
    }
    const form = exerciseFormOf(action, fields);
    if (!['saved', 'changed', 'partly_saved'].includes(a.outcome)) {
      if (form) this.errs[form] = a.reason ?? a.head;
      return;
    }
    if (form) delete this.errs[form];
    this.changed = null;
    if (action === 'gym_rename') {
      this.renaming = null;
      this.changed = Number(fields.exercise_id);
    } else if (action === 'gym_active') {
      this.changed = Number(fields.exercise_id);
    } else if (action === 'gym_new') {
      const had = new Set(before?.exercises.map((x) => x.exercise_id));
      const name = tidy(String(fields.name ?? '')).toLowerCase();
      this.changed = after?.exercises.find((x) => !had.has(x.exercise_id) || x.name.toLowerCase() === name)?.exercise_id ?? null;
      this.adding = false;
      this.newOne = newDraft();
    }
  }
}

const KEY = Symbol('exercises-page');
export const setExercisesPage = (p: ExercisesPage) => setContext(KEY, p);
export const getExercisesPage = () => getContext<ExercisesPage>(KEY);
