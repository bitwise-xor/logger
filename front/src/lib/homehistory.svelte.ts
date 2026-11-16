/**
 * Home's History page's state in the browser (deploy 100): the read on screen (?n= rows), a row that left at once (×), the rows a save
 * added (blue edge), and "+ Add one done earlier" (open, the job and the date typed, why it was refused: next to the form). Every save
 * goes to a form action of /home/history (home_remove, home_earlier, undo) and its answer brings the fresh History read (view
 * "home_history" with the page's limit). home_earlier takes a key (a new one per tap), home_remove none; a button is blocked while
 * its save is on the way and no Home save is ever sent again by the page (saver.ts).
 */
import { getContext, setContext } from 'svelte';
import { Answers } from './answers.svelte.js';
import type { SaveAnswer, Undo } from './day.js';
import { earlierProblem, earlierRange } from './home.js';
import { doneKey, earlierFields, jobValue, removeFields, type History } from './homeparts.js';
import type { Done } from './home.js';
import type { FieldValues } from './saver.js';

const WENT = ['saved', 'changed', 'partly_saved'];

export class HistoryPage extends Answers {
  history = $state.raw<History | null>(null);
  /** A row on its way off the list (× tapped), by its ids. */
  gone = $state<Record<string, boolean>>({});
  /** Rows a save added (blue edge), by their ids. */
  fresh = $state<Record<string, boolean>>({});
  open = $state(false);
  job = $state('');
  date = $state('');
  err = $state<string | null>(null);

  #loaded: History | null = null;

  constructor(history: History | null, undo: Undo | null) {
    super('/home/history');
    this.load(history, undo);
  }

  load(history: History | null, undo: Undo | null) {
    if (history === this.#loaded) return;
    this.#loaded = history;
    this.history = history;
    this.gone = {};
    this.fresh = {};
    this.open = false;
    this.job = history?.jobs[0] ? jobValue(history.jobs[0]) : '';
    this.date = '';
    this.err = null;
    if ((undo?.token ?? null) !== this.undoToken) this.loadUndo(undo);
  }

  get range() {
    return this.history ? earlierRange(this.history) : null;
  }

  toggle() {
    this.open = !this.open;
    this.err = null;
  }

  /** × on a row: it leaves at once, and comes back if the save was refused. */
  async remove(e: Done) {
    const k = doneKey(e);
    if (this.gone[k]) return;
    this.gone[k] = true;
    try {
      await this.tap('home_remove', `remove:${k}`, removeFields(e));
    } finally {
      delete this.gone[k];
    }
  }

  /** "+ Add one done earlier": Save, with the date checked first in the door's words. */
  async save() {
    const stop = this.range ? earlierProblem(this.date, this.range) : null;
    if (!this.job) this.err = 'Pick a job from the list.';
    else if (stop) this.err = stop;
    else {
      this.err = null;
      await this.tap('home_earlier', 'earlier', earlierFields(this.job, this.date));
    }
  }

  protected extra(_action: string): FieldValues {
    return { view: 'home_history', view_limit: String(this.history?.limit ?? 60) };
  }

  /** "+ Add one done earlier" says its refusal next to its form. */
  protected inlineRefusal(action: string) {
    return action === 'home_earlier';
  }

  protected take(a: SaveAnswer, action: string, _fields: FieldValues) {
    const before = new Set((this.history?.days ?? []).flatMap((d) => d.rows.map(doneKey)));
    const after = a.home_history;
    if (after) {
      this.history = after;
      this.#loaded = after;
    }
    if (action === 'home_earlier') {
      if (!WENT.includes(a.outcome)) {
        this.err = a.reason ?? a.head;
        return;
      }
      this.err = null;
      this.open = false;
      this.date = '';
      this.fresh = Object.fromEntries((after?.days ?? []).flatMap((d) => d.rows.map(doneKey)).filter((k) => !before.has(k)).map((k) => [k, true]));
    } else this.fresh = {};
  }
}

const KEY = Symbol('home-history');
export const setHistoryPage = (p: HistoryPage) => setContext(KEY, p);
export const getHistoryPage = () => getContext<HistoryPage>(KEY);
