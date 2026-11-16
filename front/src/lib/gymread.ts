/**
 * The Gym's read-only parts (deploy 97): Progress, History and Activity. The door's shapes (docs/API.md, GET /gym/progress,
 * /gym/history and /gym/activity) and what the pages make of them: the question's `x` and `day`, the lines of the Progress card, the
 * bars of "Workouts per week" (app.'s drawing of per_week, as numbers), what a History card shows and its anchor, and the Activity
 * day's links, times and set-up guide. Plain TypeScript, so the tests need no browser.
 */
import type { ChartData } from './chart.js';
import { dayName, type GymSet, type Kind } from './gym.js';

// ---- the questions -----------------------------------------------------------------------------------------------------------------

/** `?x=` of Progress: an exercise's id (digits only; anything else is dropped and the door picks the most recent one). */
export const askedExercise = (x: string | null): string | undefined => (x !== null && /^\d{1,12}$/.test(x) ? x : undefined);

/** `?day=` of Activity: yyyy-mm-dd that is a real date (anything else is dropped: today). */
export function askedDay(day: string | null): string | undefined {
  if (day === null || !/^\d{4}-\d\d-\d\d$/.test(day)) return undefined;
  const d = new Date(`${day}T12:00:00Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== day ? undefined : day;
}

// ---- Progress ----------------------------------------------------------------------------------------------------------------------

export interface PerWeek {
  weeks: { start: string; n: number }[];
  top: number;
  good: number;
}

export interface Progress {
  today: string;
  start: string;
  weeks: number;
  per_week: PerWeek;
  /** The chips: every exercise done, the most recently done first. */
  exercises: { exercise_id: number; name: string; on: boolean }[];
  exercise: null | { exercise_id: number; name: string; kind: Kind };
  unit?: string;
  title?: string;
  top?: number;
  top_reps?: number | null;
  top_text?: string;
  change?: string;
  one_rep_max?: number | null;
  sub?: string;
  chart?: ChartData | null;
  recent?: { day: string; text: string; rows: GymSet[] }[];
}

/** A chip's address: Progress of that exercise. */
export const progressHref = (id: number): string => `/gym/progress?x=${id}`;

/** The card's title: "Bench press: top weight". */
export const progressTitle = (p: Pick<Progress, 'exercise' | 'title'>): string => (p.exercise ? `${p.exercise.name}: ${p.title ?? ''}`.trim() : '');

/**
 * The line under the top number as pieces: "Top set 70 kg × 6 · estimated 1-rep max ≈ 84 kg" is two, "Last session Tue 04.11." one
 * (the core's own line, cut where it joins its parts). The estimated 1-rep max is marked, so the page can set it apart.
 */
export function subParts(sub: string | undefined): { text: string; orm: boolean }[] {
  return (sub ?? '')
    .split(' · ')
    .filter(Boolean)
    .map((text) => ({ text: text.charAt(0).toUpperCase() + text.slice(1), orm: /1-rep max/.test(text) }));
}

const dm = (iso: string): string => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.`;

/** One bar of "Workouts per week": app.'s drawing (viewBox 320 × 84, a bar 24 wide every 40, up to 56 high). */
export interface Bar {
  x: number;
  y: number;
  h: number;
  /** The count above the bar and the Monday under it (dd.mm.). */
  n: number;
  cx: number;
  ny: number;
  label: string;
  /** This week (the last bar). */
  now: boolean;
}

export const BARS_W = 320;
export const BARS_H = 84;
export const BARS_BASE = 64;

const round1 = (x: number): number => Math.round(x * 10) / 10;

export function bars(p: PerWeek): Bar[] {
  const top = Math.max(1, p.top);
  return p.weeks.map((w, i) => {
    const h = round1((w.n / top) * 56);
    return { x: 8 + i * 40, y: round1(BARS_BASE - h), h, n: w.n, cx: 20 + i * 40, ny: round1(60 - h), label: dm(w.start), now: i === p.weeks.length - 1 };
  });
}

/** "5 of 8 weeks with 2+". */
export const goodWeeks = (p: PerWeek): string => `${p.good} of ${p.weeks.length} weeks with 2+`;

/** The picture's label: "Workouts per week: week of 28.09.: 3, week of 05.10.: 2, …". */
export const barsLabel = (p: PerWeek): string => `Workouts per week: ${p.weeks.map((w) => `week of ${dm(w.start)}: ${w.n}`).join(', ')}`;

/** A session of the small table: "Mon 16.11." and its rows as one line. */
export const sessionDay = (iso: string): string => dayName(iso);

// ---- History -----------------------------------------------------------------------------------------------------------------------

export interface HistoryWorkout {
  workout_id: number;
  anchor: string;
  day: string;
  split_day_id: number | null;
  split: string;
  started_at: string;
  ended_at: string | null;
  when: string;
  exercises: { exercise_id: number; name: string; kind: Kind; text: string; rows: GymSet[] }[];
}

/** A card's date as app. writes it: "Mon 16.11.2026". */
export const cardDate = (w: Pick<HistoryWorkout, 'day'>): string => `${dayName(w.day)}${w.day.slice(0, 4)}`;

/** The small line by the date: "Push · 17:05–18:10" or "Free workout · 17:05". */
export const cardSub = (w: Pick<HistoryWorkout, 'split' | 'when'>): string => `${w.split} · ${w.when}`;

/** A card's address: the page, with its anchor (a search result and a link jump to it). */
export const cardHref = (w: Pick<HistoryWorkout, 'anchor'>): string => `/gym/history#${w.anchor}`;

/** What one exercise of a card says: its name and its rows as one line (the door's `text`; the rows when it has none). */
export const exerciseLine = (x: HistoryWorkout['exercises'][number]): { name: string; text: string } => ({
  name: x.name,
  text: x.text || x.rows.map((r) => r.text).join(', '),
});

// ---- Activity ----------------------------------------------------------------------------------------------------------------------

export interface SetupStep {
  text: string;
  code: boolean;
}

export interface Activity {
  has_data: boolean;
  setup: null | { title: string; token_set: boolean; intro: string; steps: SetupStep[][]; note: string };
  today: string | null;
  day: string | null;
  label: string | null;
  prev_day: string | null;
  next_day: string | null;
  tiles: { key: string; label: string; value: number | null; unit: string | null; text: string; avg7: number | null; sub: string | null }[];
  sleep: null | {
    hours: number;
    text: string;
    in_bed_from: string | null;
    in_bed_to: string | null;
    in_bed: string;
    stages: { key: string; label: string; hours: number; text: string }[];
    stages_text: string;
    typed: null | { bed_at: string; wake_at: string; hours: number };
    typed_text: string;
  };
  workouts: {
    name: string;
    start_at: string;
    end_at: string;
    minutes: number;
    kcal: number | null;
    hr_avg: number | null;
    km: number | null;
    meta: string;
    matches: string | null;
  }[];
  charts: { id: string; title: string; chart: ChartData }[];
}

/** A day link: the page of that day; today's own is the page without a day. */
export const activityHref = (day: string, today: string | null): string => (day === today ? '/gym/activity' : `/gym/activity?day=${day}`);

/** "Yesterday 15.11.2026": the label and the date. */
export const activityTitle = (a: Pick<Activity, 'label' | 'day'>): { label: string; date: string } => ({
  label: a.label ?? '',
  date: a.day ? `${a.day.slice(8, 10)}.${a.day.slice(5, 7)}.${a.day.slice(0, 4)}` : '',
});

/** The clock time of an ISO time as the door sent it (Berlin time with its offset): "2026-11-16T17:05:00+01:00" → "17:05". */
export const clock = (iso: string): string => iso.slice(11, 16);

/** The times of a watch workout: "17:05–18:10". */
export const watchTimes = (w: Pick<Activity['workouts'][number], 'start_at' | 'end_at'>): string => `${clock(w.start_at)}–${clock(w.end_at)}`;

/** "Matches Day 2 · Pull in the Logger", or null. */
export const matchLine = (w: Pick<Activity['workouts'][number], 'matches'>): string | null => (w.matches ? `Matches ${w.matches} in the Logger` : null);
