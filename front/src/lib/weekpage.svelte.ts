/**
 * Trends' Week tab in the browser (deploy 102): the Week on screen, "Show all" of the foods and the days, and the Week review's
 * button. The button posts its form to the page's form action `coach_start` (the Saver, src/lib/saver.ts: no key, never sent again
 * by itself) and the answer's fresh Week replaces the one shown, in place. The door's words of the answer (its head, a refusal's
 * reason, or why nothing came back) are said next to the review card; there is no answer bar and no Undo (the door has none here).
 * While a review is read the page asks about it every 5 seconds (StatusPoll in week.ts, driven by the page) and reads the week
 * again when it is ready.
 */
import { goto } from '$app/navigation';
import { deserialize } from '$app/forms';
import type { SaveAnswer } from './day.js';
import { loginHref } from './next.js';
import { Saver } from './saver.js';
import { OneStart, startFields, type Period, type Week } from './week.js';

export interface Said {
  tone: 'ok' | 'warning';
  lines: string[];
}

export class WeekPage {
  week = $state.raw<Week | null>(null);
  p: Period;
  /** The review's start is on its way: the button is disabled from the first press until the answer is in. */
  starting = $state(false);
  /** The door's words of the last press, next to the review card. */
  said = $state<Said | null>(null);
  /** Still being read after 5 minutes: the card says it takes longer, with "Look again". */
  slow = $state(false);
  foodsAll = $state(false);
  daysAll = $state(false);

  #saver: Saver;
  #one = new OneStart();
  #loaded: Week | null = null;

  constructor(week: Week | null, p: Period) {
    this.p = p;
    this.#saver = new Saver({ fetch: (u, i) => fetch(u, i), deserialize: (t) => deserialize(t) as never, storage: null, page: '/trends' });
    this.load(week, p);
  }

  /** The page's load (a visit, another period, the week read again after a review): a new period folds the lists again. */
  load(week: Week | null, p: Period) {
    if (week === this.#loaded) return;
    this.#loaded = week;
    if (p !== this.p) {
      this.foodsAll = false;
      this.daysAll = false;
      this.said = null;
    }
    this.p = p;
    this.week = week;
    this.slow = false;
    // the words of a press stay while the review it started is read; once it is over the card itself says how it went
    if (week?.review?.state !== 'working') this.said = null;
  }

  /** The review button: one press, one start. */
  async start() {
    const r = this.week?.review;
    const fields = r ? startFields(r, this.p) : null;
    if (!fields || this.starting || this.#one.busy) return;
    this.starting = true;
    this.said = null;
    try {
      const sent = await this.#one.press(() => this.#saver.send<SaveAnswer & { week?: Week }>('coach_start', fields));
      if (!sent || sent.kind === 'stale') return;
      if (sent.kind === 'signed_out') {
        void goto(loginHref(location.pathname + location.search));
        return;
      }
      if (sent.kind === 'problem') {
        this.said = { tone: 'warning', lines: ['Not saved.', sent.message] };
        return;
      }
      const a = sent.answer;
      if (a.week) {
        this.#loaded = a.week;
        this.week = a.week;
        this.slow = false;
      }
      this.said = { tone: a.tone === 'ok' ? 'ok' : 'warning', lines: [a.head, a.reason].filter((x): x is string => !!x) };
    } finally {
      this.starting = false;
    }
  }
}
