/**
 * Home's first pages' state in the browser (deploy 99): the Now page (the read on screen, its six rows in place after a tick, the
 * tick filled at once with the blue edge) and the Pick page (the job, the timer's clock counting down from the read's seconds left,
 * the screen kept on while it runs, a refusal next to its button). The answer bar and the taps on their way are the shared part
 * (answers.svelte.ts). Every save goes to a form action of its page (home_tick and undo on /home; the timer, Done, Done next job,
 * Not today and Done it earlier? on /home/pick) and its answer brings the page's fresh read (view "home" with the time, or
 * "home_pick" with the time and the job's n). "Done" on Pick ends on /home with its answer bar (and Undo) carried over.
 * No Home save is ever sent again by the page (saver.ts), so neither page re-sends anything on mount.
 */
import { goto } from '$app/navigation';
import { getContext, setContext } from 'svelte';
import { Answers, type Bar } from './answers.svelte.js';
import type { SaveAnswer, Undo } from './day.js';
import {
  earlierProblem,
  earlierRange,
  keepOrder,
  pairKey,
  pickFields,
  secondsLeft,
  tickFields,
  timerView,
  type HomePick,
  type HomeRow,
  type Now,
} from './home.js';
import type { FieldValues } from './saver.js';

const WENT = ['saved', 'changed', 'partly_saved'];

/** "Done" on Pick: its answer bar, shown on Now once it is there (a module value: one tab, one page at a time). */
let carried: Omit<Bar, 'id'> | null = null;

export class NowPage extends Answers {
  now = $state.raw<Now | null>(null);
  /** The six rows on screen: the read's first six on a load; after a save each keeps its place (keepOrder). */
  rows = $state.raw<HomeRow[]>([]);
  /** A tick on its way, by pair: the circle shows it done (or not) at once. */
  pending = $state<Record<string, boolean>>({});
  /** The pair a tick changed (blue edge on its circle). */
  changed = $state<string | null>(null);
  /** The time of the page's address (?min=), for the fresh read. */
  min: string;
  /** The Timer card's countdown: when the timer ends in this browser's clock, and the clock's now (redrawn every second). */
  end = $state(0);
  tickNow = $state(Date.now());

  #loaded: Now | null = null;

  constructor(now: Now | null, undo: Undo | null, min: string) {
    super('/home');
    this.min = min;
    this.load(now, undo, min);
  }

  /** The page's load (a visit, another time chip), with the session's Undo, or the bar "Done" on Pick carried here. */
  load(now: Now | null, undo: Undo | null, min: string) {
    if (now === this.#loaded) return;
    this.#loaded = now;
    this.min = min;
    this.#put(now);
    this.rows = now ? now.rows.slice(0, now.shown) : [];
    this.pending = {};
    this.changed = null;
    const c = carried;
    carried = null;
    if (c) {
      this.undoToken = c.undo?.token ?? null;
      this.show(c);
    } else if ((undo?.token ?? null) !== this.undoToken) this.loadUndo(undo);
  }

  #put(now: Now | null) {
    this.now = now;
    this.tickNow = Date.now();
    this.end = this.tickNow + (now?.timer?.left ?? 0) * 1000;
  }

  /** The Timer card's seconds left: counting while it runs, a paused timer's as read. */
  get left(): number {
    const t = this.now?.timer;
    if (!t) return 0;
    return t.state === 'running' ? secondsLeft(this.end, this.tickNow) : t.state === 'over' ? 0 : t.left;
  }

  /** Done today, as the circle shows it: a tick on its way at once, else the read's. */
  done(r: HomeRow): boolean {
    return this.pending[pairKey(r)] ?? r.done_today;
  }

  /** The tick circle: done now, or the tick taken back (the door's tick toggles a pair done today). */
  async tick(r: HomeRow) {
    const k = pairKey(r);
    if (this.busy[`tick:${k}`]) return;
    this.pending[k] = !r.done_today;
    this.changed = k;
    try {
      await this.tap('home_tick', `tick:${k}`, tickFields(r));
    } finally {
      delete this.pending[k];
    }
  }

  protected extra(_action: string): FieldValues {
    return { view: 'home', view_min: this.min };
  }

  /** The fresh Now on screen, the six rows in their places; a refusal leaves no blue edge. */
  protected take(a: SaveAnswer, action: string, _fields: FieldValues) {
    const after = a.home;
    if (after) {
      this.rows = keepOrder(this.rows, after.rows, after.shown);
      this.#put(after);
      this.#loaded = after;
    }
    if (!WENT.includes(a.outcome) || action === 'undo') this.changed = null;
  }
}

/** Where a Pick button's refusal is said: next to that button. */
export type PickSpot = 'start' | 'pause' | 'resume' | 'stop' | 'done' | 'next' | 'skip' | 'earlier';
const SPOT: Record<string, PickSpot> = {
  home_start: 'start', home_pause: 'pause', home_resume: 'resume', home_stop: 'stop', home_pickdone: 'done', home_picknext: 'next', home_skip: 'skip', home_earlier: 'earlier',
};

export class PickPage extends Answers {
  pick = $state.raw<HomePick | null>(null);
  /** When the timer ends, in this browser's clock (from the read's seconds left), and the clock's now (redrawn every quarter second). */
  end = $state(0);
  tickNow = $state(Date.now());
  /** "Done it earlier?" open, and the date typed. */
  earlierOpen = $state(false);
  earlierDate = $state('');
  /** A refusal, next to its button. */
  err = $state<null | { spot: PickSpot; text: string }>(null);
  /** The page's address: ?min= and ?n= (for the fresh read; a timer's job does not look at them). */
  min: string;
  n: string;

  #loaded: HomePick | null = null;

  constructor(pick: HomePick | null, undo: Undo | null, min: string, n: string) {
    super('/home/pick');
    this.min = min;
    this.n = n;
    this.load(pick, undo, min, n);
  }

  load(pick: HomePick | null, undo: Undo | null, min: string, n: string) {
    if (pick === this.#loaded) return;
    this.min = min;
    this.n = n;
    this.#put(pick);
    this.err = null;
    if ((undo?.token ?? null) !== this.undoToken) this.loadUndo(undo);
  }

  #put(pick: HomePick | null) {
    const job = (p: HomePick | null) => (p?.job ? p.job.pairs.join(' ') : null);
    if (job(pick) !== job(this.pick)) {
      this.earlierOpen = false;
      this.earlierDate = '';
    }
    this.#loaded = pick;
    this.pick = pick;
    this.tickNow = Date.now();
    this.end = this.tickNow + (pick?.timer?.left ?? 0) * 1000;
  }

  /** Seconds left now: counting while it runs; a paused timer's are the read's. */
  get left(): number {
    const t = this.pick?.timer;
    if (!t) return 0;
    if (t.state === 'running') return secondsLeft(this.end, this.tickNow);
    return t.state === 'over' ? 0 : t.left;
  }

  get view() {
    const p = this.pick;
    return timerView(p?.timer ?? null, this.left, p?.minutes ?? 15, p?.next_from_s ?? 180);
  }

  get range() {
    return this.pick ? earlierRange(this.pick) : null;
  }

  // ---- the buttons -------------------------------------------------------------------------------------------------------------

  async start() {
    const p = this.pick;
    if (p?.job) await this.tap('home_start', 'start', pickFields.start(p, p.job));
  }

  async pause() {
    const t = this.pick?.timer;
    if (t) await this.tap('home_pause', 'pause', pickFields.timer(t));
  }

  async resume() {
    const t = this.pick?.timer;
    if (t) await this.tap('home_resume', 'resume', pickFields.timer(t));
  }

  async stop() {
    const t = this.pick?.timer;
    if (t) await this.tap('home_stop', 'stop', pickFields.timer(t));
  }

  /** "Done": the job ticked (and the timer closed); the page ends on Now, with this answer's bar (and Undo) there. */
  async done() {
    const p = this.pick;
    if (!p?.job) return;
    const a = await this.tap('home_pickdone', 'done', pickFields.done(p.job, p.timer));
    if (a && WENT.includes(a.outcome) && this.bar) {
      const { id: _id, ...bar } = this.bar;
      carried = bar;
      await goto('/home');
    }
  }

  /** "Done, next job": the job ticked, the timer goes on with the next job that fits (or closes); the page stays. */
  async next() {
    const p = this.pick;
    if (p?.job && p.timer) await this.tap('home_picknext', 'next', pickFields.next(p.job, p.timer));
  }

  async skip() {
    const p = this.pick;
    if (p?.job) await this.tap('home_skip', 'skip', pickFields.skip(p.job));
  }

  /** "Yesterday", "2 days ago", or the date typed (checked first in the door's words). */
  async earlier(when: number | string) {
    const p = this.pick;
    if (!p?.job) return;
    if (typeof when === 'string') {
      const stop = this.range ? earlierProblem(when, this.range) : null;
      if (stop) {
        this.err = { spot: 'earlier', text: stop };
        return;
      }
    }
    this.err = null;
    await this.tap('home_earlier', `earlier:${when}`, pickFields.earlier(p.job, when));
  }

  // ---- the saves ---------------------------------------------------------------------------------------------------------------

  /** Done asks for Now's read (the page goes there); every other save for this page's, with its time and job. */
  protected extra(action: string): FieldValues {
    if (action === 'home_pickdone') return { view: 'home', view_min: this.min };
    return { view: 'home_pick', view_min: this.min, view_n: this.n };
  }

  /** Every refusal of a button is said next to it. */
  protected inlineRefusal(action: string) {
    return action in SPOT;
  }

  protected take(a: SaveAnswer, action: string, _fields: FieldValues) {
    if (a.home_pick) this.#put(a.home_pick);
    if (a.outcome === 'rejected' && action in SPOT) this.err = { spot: SPOT[action]!, text: a.reason ?? a.head };
    else this.err = null;
    if (action === 'home_earlier' && WENT.includes(a.outcome)) {
      this.earlierOpen = false;
      this.earlierDate = '';
    }
  }
}

const NOW = Symbol('home-now');
export const setNowPage = (p: NowPage) => setContext(NOW, p);
export const getNowPage = () => getContext<NowPage>(NOW);
