/**
 * Library > Foods > Words' state in the browser (core item 24): the list on screen (the page's address carries ?q= and ?shared=1),
 * the search box's words, and a word's Remove. Every save goes to the form action of /library/words (the Catalogue's word save, with
 * view "words" and the page's search and chip), and its answer brings the fresh list and the Undo of that word, which replace
 * the page with no reload; Undo brings the list again the same way. The answer bar and the taps on their way are the shared part
 * (answers.svelte.ts). The save has no key and is never sent again by the page (saver.ts, `catalogue_`).
 */
import { goto } from '$app/navigation';
import { getContext, setContext } from 'svelte';
import { Answers } from './answers.svelte.js';
import type { SaveAnswer, Undo } from './day.js';
import type { FieldValues } from './saver.js';
import { askedQ, removeFields, viewFields, wordsHref, type View, type WordRow, type Words } from './words.js';

export type WordsAnswer = SaveAnswer & { words?: Words };

/** How long the search waits after the last key before it asks (Enter asks at once). */
export const SEARCH_PAUSE_MS = 400;

export class WordsPage extends Answers {
  words = $state.raw<Words | null>(null);
  view = $state.raw<View>({ q: '', shared: false });
  /** The search box's words (the address has them once asked). */
  search = $state('');

  #loaded: Words | null = null;
  #timer: ReturnType<typeof setTimeout> | undefined;

  constructor(words: Words | null, view: View, undo: Undo | null) {
    super('/library/words');
    this.load(words, view, undo);
  }

  /** The page's load (a visit, another search or chip). */
  load(words: Words | null, view: View, undo: Undo | null) {
    if (this.#loaded === words) return;
    this.#loaded = words;
    this.words = words;
    this.view = view;
    // the box being typed in keeps its words while the address catches up
    if (askedQ(this.search) !== view.q) this.search = view.q;
    this.loadUndo(undo);
  }

  /** Another search or chip: the page's address. `replace`: typing, which does not make history. */
  go(v: Partial<View>, replace = false) {
    clearTimeout(this.#timer);
    void goto(wordsHref({ ...this.view, ...v }), { replace, reset: false });
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

  /** The id a word's button is busy under. */
  static busyId = (r: Pick<WordRow, 'food_id' | 'word'>) => `rm:${r.food_id}:${r.word}`;

  /** Remove: the Catalogue's word save for this food and word; the answer brings the list again, and Undo while it lasts. */
  async remove(r: WordRow) {
    await this.tap('catalogue_words', WordsPage.busyId(r), removeFields(r));
  }

  protected extra(_action: string): FieldValues {
    return viewFields(this.view);
  }

  protected take(answer: SaveAnswer, _action: string, _fields: FieldValues) {
    const a = answer as WordsAnswer;
    if (a.words) {
      this.words = a.words;
      this.#loaded = a.words;
    }
  }
}

const KEY = Symbol('words-page');
export const setWordsPage = (p: WordsPage) => setContext(KEY, p);
export const getWordsPage = () => getContext<WordsPage>(KEY);
