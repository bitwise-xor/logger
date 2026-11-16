/**
 * The Usual meals page's state in the browser (deploy 87): the list, the meal open to change (its draft: every change kept until
 * one Save), the food search, and the meal a save or an Undo touched (blue edge). The answer bar and the taps on their way are the
 * shared part (answers.svelte.ts). Every save goes to a form action of /food/usual (usual_meal, usual_new, undo) and its answer
 * brings the whole list fresh (view "usual"), which replaces the page with no reload. A refusal says why next to Save and keeps
 * the edits.
 */
import { getContext, setContext } from 'svelte';
import { Answers } from './answers.svelte.js';
import type { SaveAnswer, Undo } from './day.js';
import type { FieldValues } from './saver.js';
import {
  addedRow,
  deleteFields,
  draftOf,
  EDIT_MOST,
  FoodSearch,
  live,
  more,
  NEW_MOST,
  newDraft,
  problem,
  removed,
  saveFields,
  searchUrl,
  swapped,
  type Draft,
  type FoodHit,
  type Usual,
} from './usual.js';

/** From 1100 px the list and the open meal side by side (the layout's desktop width). */
const WIDE = '(min-width: 68.75rem)';

export class UsualPage extends Answers {
  list = $state.raw<Usual[] | null>(null);
  draft = $state<Draft | null>(null);
  /** The meal a save or an Undo just touched: a blue edge on its card. */
  fresh = $state<number | null>(null);
  /** Why the last Save did not go through (a refusal of the door, or a check before sending). */
  err = $state<string | null>(null);
  /** The search field: open to add a food (for null) or to swap a row (its id). */
  search = $state<null | { for: string | null }>(null);
  q = $state('');
  hits = $state.raw<FoodHit[] | null>(null);

  #loaded: Usual[] | null = null;
  #added = 0;
  /** The meal the last save touched, to open again after its Undo (PC). */
  #touched: number | null = null;
  #finder = new FoodSearch(async (q) => {
    const r = await fetch(searchUrl(q), { headers: { accept: 'application/json' }, cache: 'no-store' });
    return r.ok ? ((await r.json()) as { foods: FoodHit[] }).foods : [];
  });

  constructor(list: Usual[] | null, undo: Undo | null, open: number | null) {
    super('/food/usual');
    this.load(list, undo, open);
  }

  /** The list the page loaded (a visit, a reload, after a sign-in), with the session's Undo; `open`: a meal to open (?open=). */
  load(list: Usual[] | null, undo: Undo | null, open: number | null) {
    if (list === this.#loaded) return;
    this.#loaded = list;
    this.list = list;
    this.fresh = null;
    const meal = open === null ? undefined : list?.find((u) => u.meal_id === open);
    if (meal) this.draft = draftOf(meal);
    else if (this.draft?.mode === 'edit' && !list?.some((u) => u.meal_id === this.draft!.meal_id)) this.draft = null;
    this.loadUndo(undo);
  }

  get wide() {
    return typeof window !== 'undefined' && window.matchMedia(WIDE).matches;
  }

  /** On the PC a meal is always open beside the list: the first one, unless one is open or a new one is being made. */
  openFirst() {
    const first = this.list?.[0];
    if (this.wide && !this.draft && first) this.openMeal(first.meal_id);
  }

  /** A card tapped: that meal opens (any other closes, its changes dropped); tapped again on a phone, it closes. */
  openMeal(id: number) {
    const u = this.list?.find((x) => x.meal_id === id);
    if (!u) return;
    this.#reset();
    this.draft = !this.wide && this.draft?.meal_id === id ? null : draftOf(u);
  }

  newMeal() {
    this.#reset();
    this.draft = newDraft();
  }

  /** Cancel: the changes are dropped (on the PC the meal shows as saved again). */
  close() {
    const id = this.draft?.mode === 'edit' ? this.draft.meal_id : null;
    this.#reset();
    this.draft = null;
    if (this.wide && id !== null) this.openMeal(id);
    else this.openFirst();
  }

  #reset() {
    this.err = null;
    this.closeSearch();
  }

  // ---- changing the open meal ------------------------------------------------------------------------------------------------

  #row(id: string, change: (r: Draft['rows'][number]) => Draft['rows'][number]) {
    const d = this.draft;
    if (!d) return;
    d.rows = d.rows.map((r) => (r.id === id ? change(r) : r));
    this.err = null;
  }

  step(id: string, dir: 1 | -1) {
    this.#row(id, (r) => ({ ...r, amount: more(r.amount, dir) }));
  }

  setAmount(id: string, amount: number) {
    this.#row(id, (r) => ({ ...r, amount }));
  }

  remove(id: string) {
    if (!this.draft) return;
    this.draft.rows = removed(this.draft, id);
    if (this.search?.for === id) this.closeSearch();
    this.err = null;
  }

  putBack(id: string) {
    this.#row(id, (r) => ({ ...r, removed: false }));
  }

  /** How many foods the open meal may have: 8 for a new one (as app.), 40 for one that is changed (the door's limit). */
  get most() {
    return this.draft?.mode === 'new' ? NEW_MOST : EDIT_MOST;
  }

  get full() {
    return !!this.draft && live(this.draft).length >= this.most;
  }

  // ---- the search ----------------------------------------------------------------------------------------------------------

  openSearch(forRow: string | null) {
    this.search = { for: forRow };
    this.q = '';
    this.hits = null;
    this.err = null;
  }

  closeSearch() {
    this.#finder.stop();
    this.search = null;
    this.q = '';
    this.hits = null;
  }

  /** Each change of the search words asks again; only the newest answer is shown. */
  async find(q: string) {
    this.q = q;
    if (!q.trim()) {
      this.#finder.stop();
      this.hits = null;
      return;
    }
    const hits = await this.#finder.find(q);
    if (hits && this.search) this.hits = hits;
  }

  /** A food picked: it replaces the row being swapped, or is added (100 g or 200 ml). */
  pick(hit: FoodHit) {
    const d = this.draft;
    const s = this.search;
    if (!d || !s) return;
    if (s.for) this.#row(s.for, (r) => swapped(r, hit));
    else if (this.full) this.err = `Up to ${this.most} foods in ${d.mode === 'new' ? 'a new' : 'one'} usual meal.`;
    else d.rows = [...d.rows, addedRow(hit, `n${++this.#added}`)];
    this.closeSearch();
  }

  // ---- saving --------------------------------------------------------------------------------------------------------------

  /** Save: one save for all the changes, made at once with Undo. A check that fails is said next to Save, nothing is sent. */
  async save() {
    const d = this.draft;
    if (!d) return;
    const stop = problem(d);
    if (stop) {
      this.err = stop;
      return;
    }
    this.err = null;
    const { action, fields } = saveFields(d);
    this.#touched = d.meal_id;
    await this.tap(action, 'usual:save', fields);
  }

  async remove_meal() {
    const d = this.draft;
    if (!d || d.mode !== 'edit') return;
    this.err = null;
    this.#touched = d.meal_id;
    await this.tap('usual_meal', 'usual:delete', deleteFields(d));
  }

  protected inlineRefusal(action: string) {
    return action === 'usual_meal' || action === 'usual_new';
  }

  /**
   * The fresh list replaces the page. Saved: the card gets a blue edge, and the meal shows as saved (PC) or the list comes back
   * (phone). Refused: the reason goes next to Save and every edit stays. An Undo: the meal it put back is the one shown.
   */
  protected take(a: SaveAnswer, action: string, fields: FieldValues) {
    if (a.usual) {
      this.list = a.usual;
      this.#loaded = null;
    }
    const list = this.list ?? [];
    if (a.outcome === 'rejected' && this.inlineRefusal(action)) {
      this.err = a.reason ?? a.head;
      return;
    }
    if (a.outcome !== 'changed') return;
    let id: number | null = null;
    if (action === 'usual_new') {
      const name = String(fields.name ?? '').toLowerCase();
      id = list.find((u) => u.name.toLowerCase() === name)?.meal_id ?? null;
    } else if (action === 'usual_meal' && fields.action === 'save') id = Number(fields.meal_id);
    else if (action === 'undo') id = this.#touched;
    const meal = id === null ? undefined : list.find((u) => u.meal_id === id);
    this.fresh = meal ? meal.meal_id : null;
    this.#reset();
    this.draft = this.wide && meal ? draftOf(meal) : null;
    if (action === 'undo') this.#touched = null;
    if (!this.draft) this.openFirst();
  }
}

const KEY = Symbol('usual-meals');
export const setUsualPage = (p: UsualPage) => setContext(KEY, p);
export const getUsualPage = () => getContext<UsualPage>(KEY);
