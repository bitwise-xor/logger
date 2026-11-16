/**
 * The Trends page's Week tab (deploy 102, step 4 of the move to logger.; the door's routes came with deploy 101): the door's Week
 * (GET /api/v1/week?p=) and what the page makes of it, the tabs of Trends, and the Week review's two browser rules: a review is
 * started by one press only (it costs about 20 cents: `OneStart`), and a review that is being read is asked about every 5 seconds
 * for at most 5 minutes (`StatusPoll`). Plain TypeScript, so the tests need no browser. The words are the door's (docs/API.md,
 * "Trends (101)"); the page re-words none of them.
 */
import { n } from './format.js';
import type { FieldValues } from './saver.js';

export const PERIODS = ['7', 'last', '30', 'this'] as const;
export type Period = (typeof PERIODS)[number];

export interface Tile {
  key: string;
  label: string;
  unit: string;
  average: number | null;
  target: number | null;
  pct: number | null;
  level: 'good' | 'warn' | 'bad' | '';
  over: boolean;
  average_text: string;
  target_text: string | null;
  note: string | null;
}

export interface Food {
  name: string;
  kcal: number;
  n: number;
  text: string;
}

export interface DayRow {
  day: string;
  label: string;
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
  kg: number | null;
  partly: boolean;
}

export interface Part {
  key: string;
  title: string;
  style: 'list' | 'numbered' | 'note';
  tone: string | null;
  items: string[];
  meal: unknown;
  text: string | null;
}

export type ReviewState = 'none' | 'working' | 'done' | 'failed';

export interface Review {
  offered: boolean;
  kind: 'week';
  start: string | null;
  end: string | null;
  title: string;
  small: string;
  state: ReviewState | null;
  id: number | null;
  wait: string | null;
  wait_note: string | null;
  parts: Part[];
  caution: string | null;
  meta: { model: string; usd: number | null; at: string; at_text: string; text: string } | null;
  failed: string | null;
  intro: string | null;
  cost: string | null;
  button: string | null;
  links: { label: string; href: string }[];
  blurb: string | null;
  latest: { start: string; end: string; text: string } | null;
  weeks: { p: Period; label: string }[] | null;
}

export interface Week {
  p: Period;
  periods: { p: Period; label: string; current: boolean }[];
  today: string;
  start: string;
  end: string;
  ndays: number;
  empty: boolean;
  empty_text: string | null;
  with_food: number | null;
  dates_text: string | null;
  days_text: string | null;
  left_out: string | null;
  today_text: string | null;
  food: Tile[];
  meter_hint: string;
  health: { key: string; label: string; value: string; detail: string | null }[];
  health_none: string;
  foods: { by_kcal: Food[]; by_count: Food[] };
  /** Not drawn on the Week tab: the food charts come on the Charts tab (deploy 103). */
  charts: unknown[];
  days: DayRow[];
  days_none: string;
  review: Review | null;
}

/** The period in the page's address (?p=): one of the door's four, else the default (as the other pages do with a bad query). */
export const askedPeriod = (p: string | null): Period => ((PERIODS as readonly string[]).includes(p ?? '') ? (p as Period) : '7');

/** A period chip's address. */
export const periodHref = (p: Period) => (p === '7' ? '/trends' : `/trends?p=${p}`);

/**
 * The tabs of Trends. Week is this app's page; until deploy 103 Charts and Insights open app.'s pages (marked "in the full app", as
 * Home's tabs were between deploys 99 and 100). Deploy 103 changes only the two hrefs (and drops `app`).
 */
export const TRENDS_TABS = [
  { key: 'week', label: 'Week', href: '/trends', app: null },
  { key: 'charts', label: 'Charts', href: null, app: '/web/food/trends' },
  { key: 'insights', label: 'Insights', href: null, app: '/web/insights' },
] as const;

/** The line under the period chips: the door's parts, joined as app. joins them. */
export const headLine = (w: Pick<Week, 'dates_text' | 'days_text' | 'left_out'>) =>
  [w.dates_text, w.days_text, w.left_out].filter((x): x is string => !!x).join(' · ');

/** Where the meter's thin 100% line sits on its track (the mockup: 125% fills the track). */
export const METER_LINE = 80;
/** A tile's bar width in percent of its track. */
export const meterFill = (pct: number | null) => (pct === null || !(pct > 0) ? 0 : Math.min(100, (pct * METER_LINE) / 100));
/** The tile's colour: amber only for the door's warn level; every other level is drawn neutral (the owner's look: never red or green). */
export const meterWarn = (t: Pick<Tile, 'level'>) => t.level === 'warn';
/** "96%" (rounded as app. rounds). */
export const pctText = (pct: number | null) => (pct === null ? '' : `${n(pct)}%`);

/** How many rows a list shows before "Show all": the foods five, the days seven. */
export const FOODS_SHOWN = 5;
export const DAYS_SHOWN = 7;
export const shown = <T>(rows: T[], limit: number, all: boolean) => (all ? rows : rows.slice(0, limit));

/** The days table's numbers: kcal grouped, kg with one digit, "–" for none. */
export const kgText = (kg: number | null) => n(kg, 1);
export const kcalText = (kcal: number) => n(kcal);

/** A link of the door's review (app.'s pages: All coachings, Your goals) opens app. until step 6. */
export const appLink = (appUrl: string, href: string) => (/^\/[a-z]/.test(href) ? `${appUrl}${href}` : `${appUrl}/web/`);

/** The review button's form: the door's period of the card, and the page's period for the fresh week. No key (the door takes none). */
export function startFields(r: Pick<Review, 'start' | 'end'>, p: Period): FieldValues | null {
  if (!r.start || !r.end) return null;
  return { start: r.start, end: r.end, view_p: p };
}

/**
 * One press starts one review: while a start is on its way, another press does nothing (the button is also disabled); nothing is
 * ever sent again by itself (no retry after a network error, not kept for after a sign-in: saver.ts). Only the owner's next press
 * sends again, after the answer is in.
 */
export class OneStart {
  #busy = false;
  get busy() {
    return this.#busy;
  }
  async press<T>(send: () => Promise<T>): Promise<T | null> {
    if (this.#busy) return null;
    this.#busy = true;
    try {
      return await send();
    } finally {
      this.#busy = false;
    }
  }
}

/** While a review is read: ask every 5 seconds, for 5 minutes at most (app.'s rule), then say it takes longer. */
export const POLL_MS = 5000;
export const POLL_LIMIT_MS = 5 * 60_000;

export type Asked = 'working' | 'over' | 'signed_out' | 'trouble';

/** What the front's status route answered: still working, over (done, failed, gone: read the week again), signed out, or trouble (ask again). */
export function statusOf(status: number, body: unknown): Asked {
  if (status === 401) return 'signed_out';
  const state = (body as { coaching?: { state?: unknown } } | null)?.coaching?.state;
  if (status !== 200 || typeof state !== 'string') return 'trouble';
  return state === 'working' ? 'working' : 'over';
}

export interface PollDeps {
  ask: () => Promise<Asked>;
  /** The review is no longer working: read the week again (in place). */
  over: () => void;
  signedOut: () => void;
  /** 5 minutes and still working: the page says it takes longer (with "Look again"). */
  slow: () => void;
  now?: () => number;
  every?: (fn: () => void, ms: number) => () => void;
}

/** The poll of one review that is being read. `stop()` ends it (the page left, the review changed). */
export class StatusPoll {
  #stop: (() => void) | null = null;
  #asking = false;
  #started = 0;
  readonly #d: Required<PollDeps>;

  constructor(deps: PollDeps) {
    this.#d = {
      now: Date.now,
      every: (fn, ms) => {
        const id = setInterval(fn, ms);
        return () => clearInterval(id);
      },
      ...deps,
    };
  }

  start() {
    this.stop();
    this.#started = this.#d.now();
    this.#stop = this.#d.every(() => void this.#tick(), POLL_MS);
  }

  stop() {
    this.#stop?.();
    this.#stop = null;
  }

  get running() {
    return this.#stop !== null;
  }

  async #tick() {
    if (this.#asking || !this.#stop) return;
    if (this.#d.now() - this.#started >= POLL_LIMIT_MS) {
      this.stop();
      this.#d.slow();
      return;
    }
    this.#asking = true;
    let a: Asked;
    try {
      a = await this.#d.ask();
    } catch {
      a = 'trouble';
    } finally {
      this.#asking = false;
    }
    if (!this.#stop) return;
    if (a === 'over') {
      this.stop();
      this.#d.over();
    } else if (a === 'signed_out') {
      this.stop();
      this.#d.signedOut();
    }
    // working, or trouble (offline for a moment): the next tick asks again
  }
}
