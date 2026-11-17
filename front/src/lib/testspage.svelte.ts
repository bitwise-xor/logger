/**
 * Medical's Tests over time tab in the browser (deploy 106): the search box's words (the page's address carries ?q= and ?t=). This tab only
 * reads: no save, no answer bar. The search asks on Enter and after a short pause in typing, with the focus kept (as Library's).
 */
import { goto } from '$app/navigation';
import { getContext, setContext, untrack } from 'svelte';
import { askedQ, testsHref, type TestsView } from './medical.js';

/** How long the search waits after the last key before it asks (Enter asks at once). */
export const SEARCH_PAUSE_MS = 400;

export class TestsPage {
  /** The search box's words (the address has them once asked). */
  search = $state('');
  view = $state.raw<TestsView>({ q: '', t: null });

  #timer: ReturnType<typeof setTimeout> | undefined;

  constructor(view: TestsView) {
    this.load(view);
  }

  load(view: TestsView) {
    this.view = view;
    // the box being typed in keeps its words while the address catches up (what is typed is not a reason to run this again)
    if (untrack(() => askedQ(this.search)) !== view.q) this.search = view.q;
  }

  /** Another search: the page's address (the test open is left; the list comes first). `replace`: typing, which does not make history. */
  go(q: string, replace = false) {
    clearTimeout(this.#timer);
    void goto(testsHref({ q }), { replace, reset: false });
  }

  /** A key in the search box: it asks after a short pause, keeping the focus. */
  typed(text: string) {
    this.search = text;
    clearTimeout(this.#timer);
    this.#timer = setTimeout(() => {
      if (askedQ(this.search) !== this.view.q) this.go(this.search, true);
    }, SEARCH_PAUSE_MS);
  }

  /** Enter in the search box: it asks at once. */
  searchNow() {
    this.go(this.search, true);
  }
}

const KEY = Symbol('tests-page');
export const setTestsPage = (p: TestsPage) => setContext(KEY, p);
export const getTestsPage = () => getContext<TestsPage>(KEY);
