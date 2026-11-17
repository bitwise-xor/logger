/**
 * The Coach page (deploy 109) and Today's Coach card: the door's GET /api/v1/coach?f=&day= and the `coach` of GET /day (docs/API.md,
 * "More (107)"), the few rules the page puts on them, and the day coaching's button (POST /coach/start, kind "day"). Plain TypeScript,
 * so the tests need no browser. The words are the door's; the page re-words none of them. The start of a coaching costs real money
 * (about 6 cents a day): the rules that keep it to one press are in week.ts (`OneStart`) and saver.ts (`coach_` is never sent again).
 */
import type { CoachMeta, Meal, Part } from './week.js';
import type { FieldValues } from './saver.js';

export type { CoachMeta, Meal, Part };

export const FILTERS = ['all', 'days', 'weeks'] as const;
export type Filter = (typeof FILTERS)[number];

/** ?f= as the door takes it; anything else is dropped (the door's own default is all). */
export const askedFilter = (x: string | null): Filter | undefined => ((FILTERS as readonly string[]).includes(x ?? '') ? (x as Filter) : undefined);

/** ?day= when it is a real calendar day (yyyy-mm-dd); anything else is dropped, so the door is never asked for it (it would answer 400). */
export function askedDay(x: string | null): string | undefined {
  if (!x || !/^\d{4}-\d\d-\d\d$/.test(x)) return undefined;
  const d = new Date(`${x}T00:00:00Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== x ? undefined : x;
}

/** The Coach page's address: all coachings and today are the page without a question. */
export function coachHref(q: { f?: Filter | string; day?: string | null } = {}): string {
  const p = new URLSearchParams();
  if (askedFilter(q.f ?? null) && q.f !== 'all') p.set('f', q.f as string);
  const day = askedDay(q.day ?? null);
  if (day) p.set('day', day);
  const s = p.toString();
  return s ? `/coach?${s}` : '/coach';
}

export type CardState = 'none' | 'working' | 'done' | 'failed';

/** The Coach card of one day (Today's, and the Coach page's "Coach a day"): the Review card's keys without the week-only ones. */
export interface Card {
  kind: 'day';
  start: string;
  end: string;
  title: string;
  small: string;
  state: CardState;
  id: number | null;
  wait: string | null;
  wait_note: string | null;
  parts: Part[];
  caution: string | null;
  meta: CoachMeta | null;
  failed: string | null;
  intro: string | null;
  cost: string | null;
  button: string | null;
  links: { label: string; href: string }[];
}

/** One finished coaching of the list. */
export interface CoachItem {
  id: number;
  kind: 'day' | 'week';
  start: string;
  end: string;
  heading: string;
  first: string | null;
  parts: Part[];
  caution: string | null;
  meta: CoachMeta | null;
}

export interface CoachRead {
  f: Filter;
  filters: { f: Filter; label: string; current: boolean }[];
  list: CoachItem[];
  empty: string;
  month: { count: number; usd: number; text: string };
  note: string;
  day: string;
  card: Card;
}

/** The meal line of a day coaching's next meal: the door's own line, or its four numbers when it has none. */
export function mealLine(m: Meal): string {
  if (m.macros) return m.macros;
  const bits: [number | null, string][] = [
    [m.kcal, 'kcal'],
    [m.protein, 'g protein'],
    [m.carbs, 'g carbs'],
    [m.fat, 'g fat'],
  ];
  return bits.filter((b): b is [number, string] => b[0] !== null && b[0] !== undefined).map(([v, u]) => `${v} ${u}`).join(' · ');
}

/** A part's tone: "warn" draws amber (the day coaching's "To improve"); every other tone is drawn as no tone. */
export const partWarns = (p: Pick<Part, 'tone'>): boolean => p.tone === 'warn';

/** The open row after a tap on a row: a second tap on the open one closes it. */
export const toggled = (open: number | null, id: number): number | null => (open === id ? null : id);

/** A link of the card with the arrow the mockup draws after it ("All coachings ›"). */
export const arrowed = (label: string): string => `${label} ›`;

/** The card's link called "Your goals" (the page's own foot line uses it too); app.'s words when the door sends none. */
export function goalsLink(card: Pick<Card, 'links'> | null | undefined): { label: string; href: string } {
  return card?.links.find((l) => /goals/i.test(l.label)) ?? { label: 'Your goals', href: '/web/settings?tab=coach' };
}

/** The button's form on the Coach page: the card's day (once), and the page's filter and day for the fresh read (view "coach"). No key. */
export function coachFields(card: Pick<Card, 'start' | 'end'>, view: { f: Filter; day: string }): FieldValues | null {
  if (!card.start) return null;
  return { start: card.start, end: card.start, view_f: view.f, view_day: view.day };
}

/** The button's form on Today: the card's day, and that day for the fresh Today (view "day"). No key. */
export function todayFields(card: Pick<Card, 'start' | 'end'>): FieldValues | null {
  if (!card.start) return null;
  return { start: card.start, end: card.start, view_day: card.start };
}

/** Today's date at the owner's place (Berlin), as yyyy-mm-dd: the latest day the date field offers when the page was asked for another day. */
export const berlinToday = (now: Date = new Date()): string => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin' }).format(now);

/** The latest day the Coach a day field offers: the door's day when the page shows today, else the later of the asked day and today here. */
export const latestDay = (shown: string, asked: string | undefined, now: Date = new Date()): string => {
  if (!asked) return shown;
  const here = berlinToday(now);
  return asked > here ? asked : here;
};
