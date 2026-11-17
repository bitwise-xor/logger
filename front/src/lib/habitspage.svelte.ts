/**
 * The Habits page's state in the browser (deploy 94): the read on screen (the door's Habits), the habit whose calendar is open,
 * the row of "Your habits" with a form or a question open (Edit, Delete) and its draft, the New habit form, the rows and the
 * day a save changed (blue edge), and why the last list form was refused. The answer bar and the taps on their way are the
 * shared part (answers.svelte.ts). Every save goes to a form action of /habits (habit, habit_day, habits_manage, undo; Library's Habits
 * tab, deploy 105: of /library/habits, the list's forms only) and its
 * answer brings the fresh read with the filter shown (view "habits"). A tick of a day has Undo in the answer bar; the list's forms
 * have none (docs/API.md), and a refusal of one is said next to its form, which keeps what was typed.
 */
import { getContext, setContext } from 'svelte';
import { Answers } from './answers.svelte.js';
import type { SaveAnswer, Undo } from './day.js';
import {
  changedNames,
  dayFields,
  deleteFields,
  editDraft,
  editFields,
  newDraft,
  newFields,
  problem,
  restoreFields,
  retireFields,
  trackFields,
  whereOf,
  type CalHabit,
  type Draft,
  type Habits,
  type ListHabit,
} from './habits.js';
import type { FieldValues } from './saver.js';

export class HabitsPage extends Answers {
  habits = $state.raw<Habits | null>(null);
  /** The habit whose calendar is open (one at a time). */
  open = $state<string | null>(null);
  /** A row of "Your habits" with its Edit form or its Delete question open (one at a time). */
  panel = $state<null | { kind: 'edit' | 'delete'; name: string }>(null);
  /** The Edit form's words, and the New habit form's. */
  draft = $state<Draft | null>(null);
  adding = $state(false);
  newOne = $state<Draft>(newDraft({ default_group: 'practice' }));
  /** The rows of the list a save changed (blue edge), and the day of the calendar (habit and day). */
  changed = $state.raw<Set<string>>(new Set());
  changedDay = $state<string | null>(null);
  /** Why a list form was refused, and where to say it (whereOf). */
  err = $state<null | { where: string; text: string }>(null);

  /** The page whose form actions the saves call and whose address the filter keeps: /habits, or Library's /library/habits (deploy 105). */
  readonly path: string;
  #loaded: Habits | null = null;

  constructor(habits: Habits | null, undo: Undo | null, path = '/habits') {
    super(path);
    this.path = path;
    this.load(habits, undo);
  }

  /** The page's load (a visit, another filter), with the session's Undo. */
  load(habits: Habits | null, undo: Undo | null) {
    if (habits === this.#loaded) return;
    this.#loaded = habits;
    this.habits = habits;
    if (habits && !this.newOne.label) this.newOne.group = habits.default_group;
    this.changed = new Set();
    this.changedDay = null;
    this.#settle();
    this.loadUndo(undo);
  }

  /** What was open for a habit that is gone from the read closes. */
  #settle() {
    const h = this.habits;
    if (this.open && !h?.calendar.some((c) => c.name === this.open)) this.open = null;
    if (this.panel && !h?.list.some((g) => g.habits.some((x) => x.name === this.panel!.name))) this.panel = null;
    if (!h) this.adding = false;
  }

  // ---- the calendar --------------------------------------------------------------------------------------------------------

  /** A habit's row tapped: its calendar opens (another one closes), or closes when it was open. */
  toggle(name: string) {
    this.open = this.open === name ? null : name;
  }

  /** A day of the calendar tapped: one save, a new key, blocked while it is on its way. Never sent again by the page. */
  async tapDay(c: CalHabit, day: string) {
    await this.tap('habit_day', `day:${c.name}:${day}`, dayFields(c, day));
  }

  // ---- the list ------------------------------------------------------------------------------------------------------------

  /** Edit: the form for a row opens with the habit's own values (another row's form or question closes). */
  startEdit(h: ListHabit) {
    this.err = null;
    this.adding = false;
    this.panel = { kind: 'edit', name: h.name };
    this.draft = editDraft(h);
  }

  askDelete(h: ListHabit) {
    this.err = null;
    this.adding = false;
    this.panel = { kind: 'delete', name: h.name };
    this.draft = null;
  }

  closePanel() {
    this.err = null;
    this.panel = null;
    this.draft = null;
  }

  newHabit() {
    this.err = null;
    this.panel = null;
    this.draft = null;
    this.adding = true;
  }

  closeNew() {
    this.err = null;
    this.adding = false;
  }

  /** Save of the Edit form: a check that fails is said next to the form and nothing is sent. */
  async saveEdit(name: string) {
    const h = this.habits;
    const d = this.draft;
    if (!h || !d) return;
    const stop = problem(d, h.limits, false);
    if (stop) {
      this.err = { where: `edit:${name}`, text: stop };
      return;
    }
    this.err = null;
    await this.tap('habits_manage', `edit:${name}`, editFields(name, d));
  }

  async addNew() {
    const h = this.habits;
    if (!h) return;
    const stop = problem(this.newOne, h.limits, true);
    if (stop) {
      this.err = { where: 'new', text: stop };
      return;
    }
    this.err = null;
    await this.tap('habits_manage', 'new', newFields(this.newOne));
  }

  async track(h: ListHabit, on: boolean) {
    this.err = null;
    await this.tap('habits_manage', `track:${h.name}`, trackFields(h.name, on));
  }

  async retire(h: ListHabit) {
    this.err = null;
    await this.tap('habits_manage', `retire:${h.name}`, retireFields(h.name));
  }

  async restore(h: ListHabit) {
    this.err = null;
    await this.tap('habits_manage', `retire:${h.name}`, restoreFields(h.name));
  }

  /** "Yes, delete": the question was asked once; this sends confirmed. */
  async remove(h: ListHabit) {
    this.err = null;
    await this.tap('habits_manage', `delete:${h.name}`, deleteFields(h.name));
  }

  // ---- the saves -------------------------------------------------------------------------------------------------------------

  /** Every save asks for the read of the filter shown. */
  protected extra(_action: string): FieldValues {
    return { view: 'habits', show: this.habits?.show ?? 'tracked' };
  }

  /** A refusal of a list form goes next to the form (the day tick's and Today's tick's go in the answer bar). */
  protected inlineRefusal(action: string) {
    return action === 'habits_manage';
  }

  /**
   * The fresh read onto the screen. A day tick: that day gets a blue edge. A list form that went through: the form closes, the
   * rows that changed get a blue edge, and a new habit's form is empty again. Refused: the reason goes next to the form and
   * everything typed stays.
   */
  protected take(a: SaveAnswer, action: string, fields: FieldValues) {
    const went = ['saved', 'changed', 'partly_saved'].includes(a.outcome);
    if (a.habits) {
      this.changed = action === 'habits_manage' && went ? changedNames(this.habits, a.habits) : new Set();
      this.habits = a.habits;
      this.#loaded = a.habits;
      this.#settle();
    }
    this.changedDay = action === 'habit_day' && went ? `${fields.name}:${fields.day}` : null;
    if (action !== 'habits_manage') return;
    if (a.outcome === 'rejected') {
      this.err = { where: whereOf(fields), text: a.reason ?? a.head };
      return;
    }
    if (!went) return;
    this.err = null;
    if (fields.action === 'new') {
      this.adding = false;
      this.newOne = newDraft(a.habits ?? this.habits ?? { default_group: 'practice' });
    } else if (fields.action === 'edit' || fields.action === 'delete') {
      this.panel = null;
      this.draft = null;
    }
  }
}

const KEY = Symbol('habits-page');
export const setHabitsPage = (p: HabitsPage) => setContext(KEY, p);
export const getHabitsPage = () => getContext<HabitsPage>(KEY);
