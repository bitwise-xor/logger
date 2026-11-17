/**
 * Library's Foods tab's state in the browser (deploy 105): the Catalogue on screen and the open food's box (the page's address carries
 * ?q=, ?f=, ?s= and ?food=), what is typed in the box's forms, why a form was refused (next to it; what was typed stays), the row a
 * save touched (blue edge), and "+ New food". The answer bar and the taps on their way are the shared part (answers.svelte.ts).
 * Every save goes to a form action of /library (the Catalogue's six forms, `lookup`, `answer`) with view "catalogue" and the page's
 * view, and its answer brings the fresh Catalogue and box, which replace the page with no reload. No save here has a key or Undo,
 * and none is ever sent again by the page (saver.ts, `catalogue_`).
 *
 * The values form is shown first by the door (needs_confirmation, its read-back in the answer bar with "Yes, change" and "No"): Yes
 * sends the same form again with confirmed. A new food is the look-up (the logging box's `lookup` save, view "catalogue"): its
 * read-back comes in the answer bar with the question's Yes and No, sent through `answer` as Today's questions are.
 */
import { goto } from '$app/navigation';
import { getContext, setContext } from 'svelte';
import { Answers, type Bar } from './answers.svelte.js';
import {
  addedIds,
  askedQ,
  barcodeFields,
  basicsFields,
  catalogueHref,
  formOf,
  lookupQuestion,
  unitFields,
  unitProblem,
  valueChanges,
  valuesDraft,
  valuesFields,
  viewFields,
  wordFields,
  type Catalogue,
  type Item,
  type View,
} from './catalogue.js';
import type { SaveAnswer, Undo } from './day.js';
import type { Sent, FieldValues } from './saver.js';

type CatalogueAnswer = SaveAnswer & { catalogue?: Catalogue; food_item?: Item | null };

/** How long the search waits after the last key before it asks (Enter asks at once). */
export const SEARCH_PAUSE_MS = 400;

export class CataloguePage extends Answers {
  cat = $state.raw<Catalogue | null>(null);
  item = $state.raw<Item | null>(null);
  view = $state.raw<View>({ q: '', f: 'all', s: 'eaten', food: null });
  /** ?food= names a food that is not there (the door's 404): its words in place of the box. */
  gone = $state<string | null>(null);

  /** The search box's words (the address has them once asked). */
  search = $state('');
  /** The box's forms. */
  draft = $state<Record<string, string>>({});
  past = $state(false);
  word = $state('');
  name = $state('');
  drink = $state(false);
  hide = $state(false);
  unit = $state('');
  grams = $state('');
  barcode = $state('');
  /** Why a form was refused, by form (values, word, words, basics, unit, barcode, review, new). */
  errs = $state<Record<string, string>>({});
  /** The row a save just changed or added (blue edge). */
  fresh = $state<number | null>(null);
  /** "+ New food": its form open, the words typed. */
  adding = $state(false);
  newText = $state('');

  #loaded: [Catalogue | null, Item | null] = [null, null];
  #timer: ReturnType<typeof setTimeout> | undefined;

  constructor(cat: Catalogue | null, item: Item | null, view: View, gone: string | null, undo: Undo | null) {
    super('/library');
    this.load(cat, item, view, gone, undo);
  }

  /** The page's load (a visit, another search, filter, order or food). */
  load(cat: Catalogue | null, item: Item | null, view: View, gone: string | null, undo: Undo | null) {
    if (this.#loaded[0] === cat && this.#loaded[1] === item) return;
    this.#loaded = [cat, item];
    this.cat = cat;
    this.view = view;
    this.gone = gone;
    // the box being typed in keeps its words while the address catches up
    if (askedQ(this.search) !== view.q) this.search = view.q;
    this.#setItem(item, false);
    this.loadUndo(undo);
  }

  /** Another food in the box (or the same one fresh): the forms start from it; the same food keeps what is typed unless `reset`. */
  #setItem(item: Item | null, reset: boolean) {
    const other = item?.id !== this.item?.id;
    this.item = item;
    if (!item) return;
    if (other) this.errs = {};
    if (other || reset) {
      this.draft = valuesDraft(item);
      this.past = false;
      this.name = item.name;
      this.drink = item.drink;
      this.hide = !item.active;
      if (other) [this.word, this.unit, this.grams, this.barcode] = ['', '', '', ''];
    }
  }

  // ---- the list ----------------------------------------------------------------------------------------------------------------

  /** Another search, filter or order: the page's address (the box closes). `replace`: typing, which does not make history. */
  go(v: Partial<View>, replace = false) {
    clearTimeout(this.#timer);
    void goto(catalogueHref({ ...this.view, food: null, ...v }), { replace, reset: false });
  }

  /** A key in the search box: it asks after a short pause, keeping the focus. */
  typed(text: string) {
    this.search = text;
    clearTimeout(this.#timer);
    this.#timer = setTimeout(() => {
      if (askedQ(this.search) !== this.view.q) this.go({ q: this.search }, true);
    }, SEARCH_PAUSE_MS);
  }

  /** Enter in the search box: it asks at once. */
  searchNow() {
    this.go({ q: this.search }, true);
  }

  /** A row tapped: its food opens (the address carries it); tapped again it closes. */
  toggle(id: number) {
    this.errs = {};
    const food = this.view.food === id ? null : id;
    this.view = { ...this.view, food };
    if (food === null) this.item = null;
    void goto(catalogueHref(this.view), { reset: false });
  }

  close() {
    if (this.view.food !== null) this.toggle(this.view.food);
  }

  // ---- the box's forms -----------------------------------------------------------------------------------------------------------

  #id() {
    return this.item?.id ?? null;
  }

  /** Save of the values: only what changed; the door shows it first (the answer bar's read-back), Yes sends it again confirmed. */
  async saveValues() {
    const item = this.item;
    if (!item) return;
    const { changed, problem } = valueChanges(item, this.draft);
    if (problem) {
      this.errs.values = problem;
      return;
    }
    delete this.errs.values;
    await this.tap('catalogue_values', 'values', valuesFields(item.id, changed, this.past));
  }

  async addWord() {
    const id = this.#id();
    if (id === null) return;
    delete this.errs.word;
    await this.tap('catalogue_words', 'word', wordFields(id, 'add', this.word));
  }

  async removeWord(word: string) {
    const id = this.#id();
    if (id === null) return;
    delete this.errs.words;
    await this.tap('catalogue_words', `words:${word}`, wordFields(id, 'remove', word));
  }

  async saveBasics() {
    const id = this.#id();
    if (id === null) return;
    delete this.errs.basics;
    await this.tap('catalogue_basics', 'basics', basicsFields(id, this.name, this.drink, this.hide));
  }

  async addUnit() {
    const id = this.#id();
    if (id === null) return;
    const stop = unitProblem(this.grams, this.item!);
    if (stop) {
      this.errs.unit = stop;
      return;
    }
    delete this.errs.unit;
    await this.tap('catalogue_unit', 'unit', unitFields(id, this.unit, this.grams));
  }

  async setBarcode() {
    const id = this.#id();
    if (id === null) return;
    delete this.errs.barcode;
    await this.tap('catalogue_barcode', 'barcode', barcodeFields(id, this.barcode));
  }

  async looksRight() {
    const id = this.#id();
    if (id === null) return;
    delete this.errs.review;
    await this.tap('catalogue_reviewed', 'review', { id: String(id) });
  }

  // ---- + New food --------------------------------------------------------------------------------------------------------------

  newFood() {
    delete this.errs.new;
    this.adding = !this.adding;
  }

  /** Look up: the logging box's look-up (USDA and Open Food Facts, up to about a minute); its read-back comes in the answer bar. */
  async lookUp() {
    delete this.errs.new;
    await this.tap('lookup', 'new', { text: this.newText });
  }

  // ---- the saves ---------------------------------------------------------------------------------------------------------------

  protected extra(_action: string): FieldValues {
    return viewFields({ ...this.view, q: this.cat?.q ?? this.view.q, f: this.cat?.filter ?? this.view.f, s: this.cat?.sort ?? this.view.s });
  }

  /** A refusal of a form (and "Nothing changed.") is said next to it; the look-up's too. */
  protected inlineRefusal(action: string) {
    return action.startsWith('catalogue_') || action === 'lookup' || action === 'answer';
  }

  /** Yes on the look-up's question is its answer "yes" through /answer; Yes on the values' read-back is the same form, confirmed. */
  protected yes(c: NonNullable<Bar['confirm']>): FieldValues {
    return c.action === 'answer' ? { reply: 'yes' } : { confirmed: '1' };
  }

  /** No on the look-up's question answers it "no" (the question closes, nothing is added); No on the values drops the change. */
  async no() {
    const c = this.bar?.confirm;
    this.closeBar();
    if (c?.action === 'answer') await this.tap('answer', 'new', { ...c.fields, reply: 'no' });
  }

  protected handle(sent: Sent<SaveAnswer>, action: string, fields: FieldValues): SaveAnswer | null {
    const a = super.handle(sent, action, fields);
    if (!a) return a;
    // "Nothing changed." is said next to the form only.
    if (a.outcome === 'unchanged' && action.startsWith('catalogue_')) this.closeBar();
    // The look-up's read-back: Yes and No in the answer bar (the question is also under Needs you on Today until answered).
    const q = action === 'lookup' ? lookupQuestion(a) : null;
    if (q) {
      this.show({
        tone: 'warning',
        head: a.head,
        lines: [],
        undo: null,
        confirm: { readBack: a.read_back ?? '', label: q.yes, noLabel: q.no, action: 'answer', fields: { question_id: q.id } },
      });
    }
    // A No answered quietly: the bar stays closed.
    if (action === 'answer' && fields.reply === 'no' && a.outcome !== 'rejected') this.closeBar();
    return a;
  }

  protected take(answer: SaveAnswer, action: string, fields: FieldValues) {
    const a = answer as CatalogueAnswer;
    const before = this.cat;
    if (a.catalogue) {
      this.cat = a.catalogue;
      this.#loaded = [a.catalogue, this.#loaded[1]];
    }
    const form = formOf(action, fields);
    const went = ['saved', 'changed', 'partly_saved'].includes(a.outcome);
    if (a.outcome === 'rejected' || a.outcome === 'unchanged') {
      if (form) this.errs[form] = a.reason ?? a.head;
      if (a.food_item) this.#setItem(a.food_item, false);
      return;
    }
    if (form) delete this.errs[form];
    if (a.outcome === 'needs_confirmation') return; // the values' read-back: what was typed stays until Yes
    if (!went) return;
    this.fresh = null;
    if (action.startsWith('catalogue_')) {
      if ('food_item' in a) this.#setItem(a.food_item ?? null, true);
      if (action === 'catalogue_words' && fields.act === 'add') this.word = '';
      if (action === 'catalogue_unit') [this.unit, this.grams] = ['', ''];
      if (action === 'catalogue_barcode') this.barcode = '';
      if (this.item) this.fresh = this.item.id;
      else if (this.view.food !== null) {
        // hidden (or gone from the list): the box closes and the address forgets the food
        this.view = { ...this.view, food: null };
        void goto(catalogueHref(this.view), { replace: true, reset: false });
      }
    } else if (action === 'answer' && a.catalogue) {
      // a new food added through the look-up's yes: its row gets a blue edge, the form closes
      this.fresh = addedIds(before, a.catalogue)[0] ?? null;
      this.adding = false;
      this.newText = '';
    }
  }
}

const KEY = Symbol('catalogue-page');
export const setCataloguePage = (p: CataloguePage) => setContext(KEY, p);
export const getCataloguePage = () => getContext<CataloguePage>(KEY);
