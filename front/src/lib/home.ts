/**
 * Home's first pages (deploy 99; the door's routes came with deploy 98): the door's shapes for Now (GET /home), Pick (GET
 * /home/pick) and Today's Home card (Day.home), and what the pages make of them: the time chips, the tabs, a row's lines and its tick, the timer's clock and what shows in each of its states, "Job i of N",
 * the earlier day's limits, the card's lines, and the fields of each save. The words are the door's (age_text, interval_text, label,
 * text, titles) wherever it gives them; ages are plain text, never red. Plain TypeScript, so the tests need no browser.
 */
import type { FieldValues } from './saver.js';

/** The built-in Pick under another name: HomePick is the door's Pick read. */
type Pick_<T, K extends keyof T> = { [P in K]: T[P] };

// ---- the door's shapes (docs/API.md, "Home (98)"; front/tests/samples/home.json is a real answer) ---------------------------

/** One chore in one zone (a whole-flat chore's waiting-longest zone on Now). */
export interface HomeRow {
  chore_id: number;
  zone_id: number;
  name: string;
  zone: string;
  short: string;
  /** "Dust · Kitchen" */
  label: string;
  flat: boolean;
  /** Days since last done; null = never logged; 0 = today. */
  age: number | null;
  age_text: string;
  interval: number;
  interval_text: string;
  minutes: number;
  done_today: boolean;
  done_at: string | null;
}

export type Pair = [number, number];

export interface Timer {
  id: number;
  state: 'running' | 'paused' | 'over';
  /** Seconds left when read: the browser counts down from it. */
  left: number;
  ends_at: string | null;
  minutes: number;
  title: string;
  pairs: Pair[];
}

export interface Done {
  ids: number[];
  chore_id: number;
  chore: string;
  zones: string[];
  flat: boolean;
  label: string;
  at: string;
  day: string;
  dated: boolean;
  source: string;
  how: string;
  time: string | null;
  /** app.'s "16.11. 08:05", or "14.11." for a job done earlier or a starting point */
  when: string;
}

export interface Now {
  today: string;
  empty: boolean;
  minutes: number;
  minutes_options: { minutes: number; label: string }[];
  timer: Timer | null;
  week: { goal: number; this: number; weeks: number[] };
  rows: HomeRow[];
  count: number;
  shown: number;
  hidden: number;
  recent: Done[];
}

export interface Job {
  pairs: Pair[];
  title: string;
  zone: string;
  age: number | null;
  age_text: string;
  minutes: number;
  steps: string[];
  howto: string | null;
  over: boolean;
  session: boolean;
}

export interface HomePick {
  today: string;
  empty: null | 'no_chores' | 'nothing_waiting';
  minutes: number;
  title: string;
  timer: Timer | null;
  job: Job | null;
  n: number | null;
  count: number;
  also: { n: number; title: string }[];
  earlier: { when: number; label: string }[];
  next_from_s: number;
  earlier_days: number;
}

/** Today's Home card (Day.home; null: a past day, no chores, or hidden in Settings). */
export interface HomeCard {
  this_week: number;
  goal: number;
  text: string;
  waiting: HomeRow | null;
  hidden: number;
}

// ---- Now ----------------------------------------------------------------------------------------------------------------------

/** The time chips (the door's minutes and labels), each a link to Now with that time; the chosen one is on. */
export const chipsOf = (now: Pick_<Now, 'minutes' | 'minutes_options'>) =>
  now.minutes_options.map((o) => ({ ...o, href: `/home?min=${o.minutes}`, on: o.minutes === now.minutes }));

/** "Pick a job for me" and the card's "15 minutes": the Pick page for a time; n: the n-th job ("Another job", "Also fits"). */
export const pickHref = (minutes: number, n?: number | null) => `/home/pick?min=${minutes}${n === undefined || n === null ? '' : `&n=${n}`}`;

/** The tabs under the title: all three are pages of this app since deploy 100 (the Zones tab is lit on Zones, a chore's page and Edit zones). */
export const TABS = [
  { key: 'now', label: 'Now', href: '/home' },
  { key: 'zones', label: 'Zones', href: '/home/zones' },
  { key: 'history', label: 'History', href: '/home/history' },
] as const;

/** A chore's own page. */
export const choreHref = (choreId: number) => `/home/chore?id=${choreId}`;

/** A row's small line (app.'s _row): "3 weeks ago · weekly". */
export const rowMeta = (r: Pick_<HomeRow, 'age_text' | 'interval_text'>) => `${r.age_text} · ${r.interval_text}`;

export const nWord = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** "1 hidden for today" (jobs marked Not today); none: no line. */
export const hiddenLine = (n: number) => (n ? `${n} hidden for today` : null);

/** "Show all N chores" (a link to Zones) when there are more than the six shown. */
export const showAll = (now: Pick_<Now, 'count' | 'shown'>) => (now.count > now.shown ? `Show all ${now.count} chores` : null);

/** "This week": "N of goal sessions", a segment per session of the goal (filled up to this week's), "Last 4 weeks: a · b · c · d". */
export function weekLines(w: Now['week']) {
  return {
    count: `${w.this} of ${w.goal} sessions`,
    segments: Array.from({ length: w.goal }, (_, i) => i < w.this),
    weeks: `Last 4 weeks: ${w.weeks.join(' · ')}`,
  };
}

export const WEEK_NOTE = 'A session is a day with a job done or a timer run out. Evening resets count on Habits.';

/** A pair's key ("3:1"): a row, a tap on its way. */
export const pairKey = (p: { chore_id: number; zone_id: number }) => `${p.chore_id}:${p.zone_id}`;

/** The tick circle: done today = filled; its words for a screen reader (app.'s aria-label). */
export const tickLabel = (r: Pick_<HomeRow, 'done_today' | 'label'>, done = r.done_today) => `${done ? 'Take the tick off: ' : 'Done: '}${r.label}`;

/** The tick's fields: the pair (the door's tick toggles a pair done today). */
export const tickFields = (r: Pick_<HomeRow, 'chore_id' | 'zone_id'>): FieldValues => ({ chore_id: String(r.chore_id), zone_id: String(r.zone_id) });

/**
 * The rows on screen after a save: the six shown keep their places (one row per chore), each with the fresh read's row of its chore,
 * so a ticked row stays where it was and a second tap takes the tick back; a chore gone from the read leaves its place to the next
 * one of the read. On a load (a visit, a reload, another time chip) the read's own order.
 */
export function keepOrder(before: HomeRow[], after: HomeRow[], shown: number): HomeRow[] {
  const byChore = new Map(after.map((r) => [r.chore_id, r]));
  const kept = before.map((r) => byChore.get(r.chore_id)).filter((r): r is HomeRow => !!r);
  const have = new Set(kept.map((r) => r.chore_id));
  return [...kept, ...after.filter((r) => !have.has(r.chore_id))].slice(0, shown);
}

// ---- the timer ----------------------------------------------------------------------------------------------------------------

/** Seconds left of a timer that ends at `end` (ms), as app.js counts: rounded, never below 0. */
export const secondsLeft = (end: number, now: number) => Math.max(0, Math.round((end - now) / 1000));

/** The Pick page's clock: "MM:SS" (minutes padded: "05:00", "60:00"). */
export const clockText = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

/** The Timer card on Now (app.'s _timer_banner and setupCountdown): "12:41 left", "12:41 left (paused)", "time is up". */
export function leftText(state: Timer['state'], s: number): string {
  if (state === 'over' || (state === 'running' && s === 0)) return 'time is up';
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')} left${state === 'paused' ? ' (paused)' : ''}`;
}

export type Clock = 'none' | 'running' | 'paused' | 'over';

/**
 * What the Pick page shows for the timer (app.'s render_pick and setupClock): its state now (a running timer at 0 seconds is over,
 * without a reload), the clock, the line under it, and its buttons: Pause or Resume, "Done, next job" only while running with
 * next_from_s or more left, "Stop timer" or "Finished".
 */
export function timerView(t: Pick_<Timer, 'state'> | null, s: number, minutes: number, nextFrom: number) {
  const state: Clock = !t ? 'none' : t.state === 'running' && s === 0 ? 'over' : t.state;
  return {
    state,
    clock: state === 'none' ? `${String(minutes).padStart(2, '0')}:00` : clockText(state === 'over' ? 0 : s),
    /** The clock counts (blue) while running; over: "Time is up · well done"; paused: "Paused." */
    live: state === 'running',
    line: state === 'over' ? 'Time is up · well done' : state === 'paused' ? 'Paused.' : null,
    pause: state === 'running',
    resume: state === 'paused',
    next: state === 'running' && s >= nextFrom,
    stop: state === 'over' ? 'Finished' : 'Stop timer',
    /** The screen stays on while it runs. */
    wake: state === 'running',
  };
}

/** The note under "Start timer". */
export const START_NOTE = 'When the timer ends, stop. It counts as a session, finished or not.';

// ---- Pick ---------------------------------------------------------------------------------------------------------------------

/** "Job 2 of 5" when there are several jobs that fit (none with a timer: count 1). */
export const jobOf = (p: Pick_<HomePick, 'n' | 'count'>) => (p.count > 1 && p.n !== null ? `Job ${p.n + 1} of ${p.count}` : null);

/** "Another job": the next n (only with more than one job). */
export const anotherHref = (p: Pick_<HomePick, 'minutes' | 'n' | 'count'>) => (p.count > 1 && p.n !== null ? pickHref(p.minutes, p.n + 1) : null);

/** The note of a job over the time (app.'s words). */
export const overNote = (j: Pick_<Job, 'over' | 'minutes'>) => (j.over ? `This job takes about ${j.minutes} minutes: do what fits, stopping counts.` : null);

/** "Also fits in 15 minutes" (the time's own minutes, as app.). */
export const alsoTitle = (minutes: number) => `Also fits in ${minutes} minutes`;

export const EMPTY = {
  no_chores: 'No zones or chores yet.',
  nothing_waiting: 'Nothing is waiting for you right now.',
  nothing_why: 'Everything is done today, hidden for today, or retired.',
} as const;

/** The form's pairs ("3-1,7-2": app.'s own format; saves.ts turns it into the door's [[3, 1], [7, 2]]). */
export const pairsValue = (pairs: Pair[]) => pairs.map(([c, z]) => `${c}-${z}`).join(',');

/** The days the date field of "Done it earlier?" allows: from earlier_days back to yesterday (the door's today). */
export function earlierRange(p: Pick_<HomePick, 'today' | 'earlier_days'>) {
  const day = (n: number) => new Date(Date.parse(`${p.today}T12:00:00Z`) - n * 86400_000).toISOString().slice(0, 10);
  return { min: day(p.earlier_days), max: day(1) };
}

/** A date typed into "Done it earlier?": inside the range, or why not (the door's words). */
export function earlierProblem(value: string, range: { min: string; max: string }): string | null {
  if (!/^\d{4}-\d\d-\d\d$/.test(value) || value < range.min || value > range.max) return 'Pick a day before today, in the last year.';
  return null;
}

/** The fields of each Pick save (docs/API.md, Home's saves; the timer id where the door wants it). */
export const pickFields = {
  start: (p: Pick_<HomePick, 'minutes'>, j: Pick_<Job, 'pairs'>): FieldValues => ({ pairs: pairsValue(j.pairs), minutes: String(p.minutes) }),
  timer: (t: Pick_<Timer, 'id'>): FieldValues => ({ timer_id: String(t.id) }),
  done: (j: Pick_<Job, 'pairs'>, t: Pick_<Timer, 'id'> | null): FieldValues => ({ pairs: pairsValue(j.pairs), ...(t ? { timer_id: String(t.id) } : {}) }),
  next: (j: Pick_<Job, 'pairs'>, t: Pick_<Timer, 'id'>): FieldValues => ({ pairs: pairsValue(j.pairs), timer_id: String(t.id) }),
  skip: (j: Pick_<Job, 'pairs'>): FieldValues => ({ pairs: pairsValue(j.pairs) }),
  earlier: (j: Pick_<Job, 'pairs'>, when: number | string): FieldValues => ({ pairs: pairsValue(j.pairs), when: String(when) }),
};

// ---- Today's Home card --------------------------------------------------------------------------------------------------------

/** The card's lines (app.'s today_card): the week's text, the chore waiting longest with its age and interval, or none waiting. */
export function cardLines(c: HomeCard) {
  return {
    week: c.text,
    waiting: c.waiting ? { label: c.waiting.label, meta: rowMeta(c.waiting) } : null,
    none: c.waiting ? null : 'Nothing else is waiting today.',
    hidden: hiddenLine(c.hidden),
  };
}

/** ?min= and ?n= of a Home page's address: digits only (up to `most` of them), else empty (the door's default then). */
export const askedNumber = (v: string | null, most: number) => (v && new RegExp(`^\\d{1,${most}}$`).test(v) ? v : '');
