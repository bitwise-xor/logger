/**
 * The Food day's state in the browser (step E, deploy 84): the day on screen, the row that is open to change, and the rows a
 * save changed or brought back (blue edge). The answer bar and the taps on their way are the shared part (answers.svelte.ts).
 * Every save goes to a form action of /food (food_entry, food_note, undo) with the day shown (`view_day`), so the answer
 * brings that day fresh and it replaces what is on screen, with no reload.
 */
import { getContext, setContext } from 'svelte';
import { Answers } from './answers.svelte.js';
import type { SaveAnswer, Undo } from './day.js';
import type { FoodDay, FoodEntry } from './food.js';
import { EntryCache, type FoodHost } from './foodhost.js';
import type { FieldValues } from './saver.js';

export class FoodPage extends Answers implements FoodHost {
  day = $state.raw<FoodDay | null>(null);
  fresh = $state.raw<Set<string>>(new Set());
  /** The row open to change (its ref), or none. */
  open = $state<string | null>(null);
  /** "Save as usual meal" (deploy 87): the meal being named (its number), the name typed, and why a save was refused. */
  naming = $state<number | null>(null);
  usualName = $state('');
  usualErr = $state<string | null>(null);
  /** A meal's note (21.11.2026): the meal whose note field is open (its number; 0: the day's note), the words typed, a refusal. */
  noting = $state<number | null>(null);
  noteText = $state('');
  noteErr = $state<string | null>(null);

  #loaded: FoodDay | null = null;
  #entries = new EntryCache();

  constructor(day: FoodDay | null, undo: Undo | null, open: string | null) {
    super('/food');
    this.load(day, undo, open);
  }

  /** The day the page loaded (a visit, another day, a reload), with the session's Undo; `open`: a row to open (from Today). */
  load(day: FoodDay | null, undo: Undo | null, open: string | null) {
    if (day === this.#loaded) return;
    this.#loaded = day;
    this.day = day;
    this.fresh = new Set();
    this.#entries.clear();
    this.open = open && day?.rows.some((r) => r.ref === open) ? open : null;
    [this.naming, this.usualName, this.usualErr] = [null, '', null];
    [this.noting, this.noteText, this.noteErr] = [null, '', null];
    this.loadUndo(undo);
  }

  /** "Save as usual meal" on a meal label: its name field opens (another closes), or closes when it was open. */
  nameMeal(meal: number) {
    this.naming = this.naming === meal ? null : meal;
    this.noting = null;
    this.usualName = '';
    this.usualErr = null;
  }

  /** A meal's note control: its field opens with the note shown (another closes, and so does "Save as usual meal"), or closes. */
  noteMeal(meal: number, current: string | null) {
    if (this.noting === meal) {
      [this.noting, this.noteText, this.noteErr] = [null, '', null];
      return;
    }
    [this.noting, this.noteText, this.noteErr] = [meal, current ?? '', null];
    this.naming = null;
  }

  protected inlineRefusal(action: string) {
    return action === 'usual_from_meal' || action === 'food_mealnote';
  }

  /** A row tapped: it opens (another one closes), or closes when it was open. */
  toggle(ref: string) {
    this.open = this.open === ref ? null : ref;
  }

  /**
   * The entry behind a row (GET /food/entry through /food/entry here): its units for the unit field. Asked once per row and
   * day; null when it cannot be read (the row's own unit is then the only one). The cache is shared with Today (foodhost.ts).
   */
  entry(ref: string): Promise<FoodEntry | null> {
    return this.#entries.get(ref);
  }

  /** Every save asks for the day shown. */
  protected extra(): FieldValues {
    return this.day ? { view_day: this.day.day } : {};
  }

  /** The fresh food day: the changed row (or one an Undo brought back) gets a blue edge; a change that went through closes the row. */
  protected take(a: SaveAnswer, action: string, fields: FieldValues) {
    if (action === 'usual_from_meal') {
      if (a.outcome === 'rejected') this.usualErr = a.reason ?? a.head;
      else if (a.outcome === 'changed') [this.naming, this.usualName, this.usualErr] = [null, '', null];
    }
    if (action === 'food_mealnote') {
      if (a.outcome === 'rejected') this.noteErr = a.reason ?? a.head;
      else [this.noting, this.noteText, this.noteErr] = [null, '', null];
    }
    const fd = a.food_day;
    if (!fd) return;
    const had = new Set(this.day?.rows.map((r) => r.ref) ?? []);
    const fresh = new Set(fd.rows.filter((r) => !had.has(r.ref)).map((r) => r.ref));
    const ref = typeof fields.ref === 'string' ? fields.ref : null;
    const changed = a.outcome === 'changed';
    if (changed && ref && fields.action !== 'delete' && fd.rows.some((r) => r.ref === ref)) fresh.add(ref);
    if (changed && (action === 'food_entry' || action === 'food_note')) this.open = null;
    if (this.open && !fd.rows.some((r) => r.ref === this.open)) this.open = null;
    this.#entries.clear(); // a change can move a row to another food (other units)
    this.fresh = fresh;
    this.day = fd;
  }
}

const KEY = Symbol('food-day');
export const setFoodPage = (p: FoodPage) => setContext(KEY, p);
export const getFoodPage = () => getContext<FoodPage>(KEY);
