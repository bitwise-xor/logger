/**
 * Trends' Charts and Insights tabs (deploy 103; the door's reads came with deploy 101): the door's Food trends and Insights shapes
 * (docs/API.md, GET /food/trends and GET /insights) and what the two pages make of them: the pages' addresses (Charts: the range and
 * the gym chart's exercise, kept when the other changes; Insights: its range of days), the insight bars' geometry and the two halves
 * of a waiting card's words.
 * Plain TypeScript, so the tests need no browser; the charts are drawn by the chart part (components/chart/).
 */
import type { ChartCard, Range } from './health.js';

export interface FoodTrends {
  range: number;
  ranges: number[];
  start: string;
  end: string;
  /** "Last 30 complete days" and "17.10. to 15.11., today not counted". */
  title: string;
  small: string;
  /** Calories, Protein, Fat and Carbs, in the shape of Health's chart cards. */
  charts: ChartCard[];
}

export interface InsightGroup {
  key: 'yes' | 'no';
  label: string;
  n: number;
  mean: number | null;
  text: string | null;
  cls: 'a' | 'b';
  /** The bar's place on its track, in percent; null while the card waits. */
  left: number | null;
  width: number | null;
}

export interface Insight {
  key: string;
  title: string;
  unit: string;
  digits: number;
  sign: boolean;
  needs: string;
  waiting: boolean;
  wait_text: string | null;
  /** The corner: "+11 mg/dL" or "no difference"; null while the card waits. */
  chip: string | null;
  say: { text: string; bold: boolean }[] | null;
  /** The door's warning when the difference is small against the usual spread, or the days are few; null when there is none. */
  caveat: string | null;
  /** Where zero is on the track (percent); null while the card waits. */
  zero: number | null;
  groups: InsightGroup[];
}

export interface Insights {
  days: number;
  /** The ranges the door answers: 90, 180 and 365 days. */
  ranges: number[];
  min_each: number;
  title: string;
  small: string;
  cards: Insight[];
  note: string;
}

/** The range switch's words: "7 days · 30 days · 90 days". */
export const rangeLabel = (r: number): string => `${r} days`;

/** The Charts page's address: the range (30 is the default and left out unless an exercise is kept) and the gym chart's exercise. */
export function chartsHref(range: number, x?: string | number | null): string {
  const q = new URLSearchParams();
  if (range !== 30 || (x !== undefined && x !== null && x !== '')) q.set('range', String(range));
  if (x !== undefined && x !== null && x !== '') q.set('x', String(x));
  const s = q.toString();
  return `/trends/charts${s ? `?${s}` : ''}`;
}

/** The range chip row: every range as a link that keeps the exercise, the asked one current. */
export const rangeLinks = (asked: Range, x?: string): { range: number; label: string; href: string; current: boolean }[] =>
  [7, 30, 90].map((r) => ({ range: r, label: rangeLabel(r), href: chartsHref(r, x), current: r === asked }));

/** The gym chips' address on this page: the range kept. */
export const chipHref = (range: number, exerciseId: number): string => chartsHref(range, exerciseId);

/** The Insights page's ranges (web item 50): the door's ?days=. */
export const INSIGHT_RANGES = [90, 180, 365] as const;

/** The asked range of days from the address: 90, 180 or 365; anything else (or nothing) is 90, never an error page. */
export function askedDays(v: string | null): number {
  const d = Number(v);
  return v !== null && /^\d+$/.test(v) && (INSIGHT_RANGES as readonly number[]).includes(d) ? d : 90;
}

/** The Insights page's address: 90 days is the default and left out. */
export const insightsHref = (days: number): string => (days === 90 ? '/trends/insights' : `/trends/insights?days=${days}`);

/** The Insights range chips: "90 days · 180 days · 365 days" (the door's ranges when it gave them), the asked one current. */
export const insightRangeLinks = (asked: number, ranges: readonly number[] = INSIGHT_RANGES): { days: number; label: string; href: string; current: boolean }[] =>
  (ranges.length ? ranges : INSIGHT_RANGES).map((d) => ({ days: d, label: rangeLabel(d), href: insightsHref(d), current: d === asked }));

/**
 * A bar of an insight card as inline styles: from `left` to `left + width` percent of the track (app. draws it so), and where zero
 * is on the track (a thin line, only when zero is not at the left edge: a value below 0 moves it right). Values are clamped into
 * 0 to 100 so a bar can never leave its track.
 */
export function barStyle(g: Pick<InsightGroup, 'left' | 'width'>, zero: number | null): { left: number; width: number; zero: number | null } {
  const clamp = (v: number) => Math.min(100, Math.max(0, v));
  const left = clamp(g.left ?? 0);
  return { left, width: Math.min(100 - left, clamp(g.width ?? 0)), zero: zero && zero > 0 ? clamp(zero) : null };
}

/** "3 days", "1 day": the group's count as the label's tail. */
export const daysText = (n: number): string => `${n} ${n === 1 ? 'day' : 'days'}`;

/**
 * A waiting card's words in two: the door's "Not enough days yet: … each needs 4." and the sentence that tells what it counts
 * ("It counts nights with …"), which the page sets smaller. Without that sentence all of it is the first part.
 */
export function waitParts(text: string | null): { head: string; counts: string | null } {
  const t = (text ?? '').trim();
  const at = t.indexOf(' It counts ');
  return at < 0 ? { head: t, counts: null } : { head: t.slice(0, at).trim(), counts: t.slice(at + 1).trim() };
}
