/**
 * Today as the door sends it (GET /api/v1/day, docs/API.md) and what the page makes of it: the header line, kcal left, the timeline
 * with meal labels, the Health card's values, what needs you. Plain TypeScript, so the unit tests need no browser.
 */
import { dayOf, hm, hours, n, plain } from './format.js';
import type { FoodDay } from './food.js';
import type { Body, BodyDue, Health } from './health.js';
import type { Habits } from './habits.js';
import type { GymCard, Workout } from './gym.js';
import type { Exercises, Plan } from './gymplan.js';
import type { HomeCard, HomePick, Now } from './home.js';
import type { Edit, History, Zones } from './homeparts.js';
import type { Usual } from './usual.js';
import type { Card, CoachRead } from './coach.js';

// ---- the door's shapes (docs/API.md; front/tests/samples/day.json is a real answer) ----------------------------------------

export interface Nutrients {
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
}
export type Targets = { [K in keyof Nutrients]: number | null };

export interface Answer {
  reply: string;
  label: string;
  style: 'primary' | 'plain' | 'quiet';
}

export interface Question {
  id: string;
  tool: string;
  kind: string | null;
  asked_at: string;
  open_until: string;
  message: string | null;
  text: string;
  read_back: string | null;
  answers: Answer[];
  free: null | { placeholder: string; type: 'text' | 'number'; unit: string | null };
  lookup: null | { name: string; source: 'usda' | 'off'; per_100: Nutrients; unit: 'g' | 'ml' };
  refill: null | { label: string; text: string };
}

export interface NotRead {
  id: number;
  received_at: string;
  text: string | null;
  tries: number;
  needs_you: boolean;
  reading: boolean;
}

export interface Review {
  ref: string;
  kind: 'food' | 'measurement' | 'event' | 'thought';
  label: string | null;
  day: string;
  reason: string;
  at: string | null;
  logged_at: string;
  thought_type: string | null;
  area: string | null;
  type: string | null;
  v1: number | null;
  v2: number | null;
  unit: string | null;
}

export interface Checkin {
  day: string;
  mood: number | null;
  energy: number | null;
  scale: { mood: string[]; energy: string[] };
}

export interface FoodRow {
  ref: string;
  kind: 'food';
  meal: number;
  at: string | null;
  time_known: boolean;
  food: string;
  food_id: number;
  amount: number;
  unit: string;
  portion_text: string | null;
  nutrients: Nutrients;
  usual_meal: null | { id: number; name: string };
}

export interface ValueRow {
  ref: string;
  kind: 'measurement' | 'event';
  type: string;
  label: string;
  at: string | null;
  time_known: boolean;
  v1: number | null;
  v2: number | null;
  unit: string | null;
  period: string | null;
  needs_review: boolean;
}

export type Row = FoodRow | ValueRow;

export interface HealthItem {
  row: 'bed' | 'wake' | 'weight' | 'sugar' | 'bp_morning' | 'bp_evening';
  label: string;
  sub: string | null;
  type: string;
  period: string | null;
  unit: string | null;
  ref: string | null;
  v1: number | null;
  v2: number | null;
  at: string | null;
  last_at: string | null;
}

export interface Habit {
  name: string;
  label: string;
  done: number;
  target: number;
  complete: boolean;
  avoid: boolean;
  last_tick: string | null;
}

export interface Day {
  day: string;
  today: string;
  past: boolean;
  header: {
    wake_at: string | null;
    slept_minutes: number | null;
    awake_minutes: number | null;
    naps: { bed_at: string; wake_at: string; minutes: number }[];
    next_sleep: boolean;
    watch_wake_at: string | null;
  };
  needs: {
    questions: Question[];
    not_read: NotRead[];
    review: Review[];
    checkin: Checkin | null;
    /** "Body measurements due" (deploy 91/92): the last session and how many days ago; null when not due (or after "Not today"). */
    body_due?: BodyDue | null;
  };
  energy: { totals: Nutrients; targets: Targets; meals: { meal: number; label: string; nutrients: Nutrients }[] };
  water: { ml: number; target_ml: number | null; glass_ml: number };
  chips: {
    again: { food_id: number; name: string; amount: number; unit: string }[];
    usual: { meal_id: number; name: string; nutrients: Nutrients; items: unknown[] }[];
  };
  rows: Row[];
  health: HealthItem[];
  habits: Habit[];
  gratitude: { count: number; goal: number };
  /** Today's Gym card (deploy 95/96); null for a past day. */
  gym?: GymCard | null;
  /** Today's Home card (deploy 98/99); null: a past day, no chores, or the card hidden in Settings > Today page. */
  home?: HomeCard | null;
  /** Today's Coach card (deploy 107/109); null: the card is hidden in Settings > Today page. */
  coach?: Card | null;
}

export interface Undo {
  token: string;
  head: string;
  expires_at: string;
}

// ---- the top bar -------------------------------------------------------------------------------------------------------------

/** "Mon 16.11. · hour 11 of your day · woke 05:40". The hour counts from the wake-up: in its first hour you are in hour 1. */
export function headerLine(d: Day): string {
  const parts = [dayOf(d.day)];
  const h = d.header;
  if (!d.past && h.awake_minutes !== null && h.awake_minutes >= 0) parts.push(`hour ${Math.floor(h.awake_minutes / 60) + 1} of your day`);
  if (h.wake_at) parts.push(`woke ${hm(h.wake_at)}`);
  return parts.join(' · ');
}

// ---- Energy --------------------------------------------------------------------------------------------------------------------

/** The big number: kcal left of the target (or over it), as app.'s Calories tile works it out; without a target, the kcal eaten. */
export function kcalLeft(e: Day['energy']): { big: string; after: string; target: string } {
  const eaten = e.totals.kcal ?? 0;
  const target = e.targets.kcal;
  if (!target) return { big: n(eaten), after: 'kcal eaten, no target set', target: '' };
  const gap = target - eaten;
  return gap >= 0 ? { big: n(gap), after: 'kcal left of', target: n(target) } : { big: n(-gap), after: 'kcal over', target: n(target) };
}

export type MacroKey = 'protein' | 'fat' | 'carbs';

export interface MacroBar {
  name: string;
  /** protein, fat or carbs: its colour (the pie's, app.'s macro colours); null for the kcal line. */
  key: MacroKey | null;
  value: number;
  /** null: no target set, the line shows the amount without a bar. */
  target: number | null;
  unit: string;
  /** Its share of the kcal from the macros, in whole per cent ("16 %"), as the pie shows it; '' for kcal or nothing eaten. */
  share: string;
}

/** kcal per gram, as app.'s "Energy from macros" (todaypage.MACRO_KCAL). */
export const KCAL_PER_G: Record<MacroKey, number> = { protein: 4, carbs: 4, fat: 9 };

/** The pie's slices (the owner, 16.11.): kcal from protein, carbs and fat, in app.'s order; null when nothing was eaten. */
export function macroPie(e: Day['energy']): null | { kcal: string; slices: { key: MacroKey; name: string; share: number }[] } {
  const order: [MacroKey, string][] = [
    ['protein', 'Protein'],
    ['carbs', 'Carbs'],
    ['fat', 'Fat'],
  ];
  const kcal = order.map(([k]) => (e.totals[k] ?? 0) * KCAL_PER_G[k]);
  const whole = kcal.reduce((a, b) => a + b, 0);
  if (!(whole > 0)) return null;
  // The middle: the day's kcal as the Calories card (from the foods' own kcal), as app.'s pie.
  return { kcal: n(e.totals.kcal || whole), slices: order.map(([key, name], i) => ({ key, name, share: kcal[i]! / whole })) };
}

/** The Energy card's lines: kcal (only against a target: the big number has it) and all three macros (the owner, 16.11.). */
export function macroBars(e: Day['energy']): MacroBar[] {
  const t = e.targets;
  const pie = macroPie(e);
  const share = (k: MacroKey) => {
    const s = pie?.slices.find((x) => x.key === k);
    return s ? `${n(s.share * 100)} %` : '';
  };
  return [
    t.kcal ? { name: 'Eaten', key: null, value: e.totals.kcal ?? 0, target: t.kcal, unit: 'kcal', share: '' } : null,
    { name: 'Protein', key: 'protein' as const, value: e.totals.protein ?? 0, target: t.protein || null, unit: 'g', share: share('protein') },
    { name: 'Fat', key: 'fat' as const, value: e.totals.fat ?? 0, target: t.fat || null, unit: 'g', share: share('fat') },
    { name: 'Carbs', key: 'carbs' as const, value: e.totals.carbs ?? 0, target: t.carbs || null, unit: 'g', share: share('carbs') },
  ].filter((b) => b !== null);
}

// ---- Your day: one timeline with meal labels ----------------------------------------------------------------------------------

/** The Health card's types: their entries are on the card, not in the timeline (the plan, question 1). */
export const HEALTH_TYPES = new Set(['bed', 'wake', 'weight', 'blood_sugar', 'bp']);

export interface Line {
  ref: string;
  time: string;
  name: string;
  sub: string;
  /** A food's macros in a small line ("P 24 · F 3 · C 60 g", the owner, 16.11.); '' for other rows. */
  macros: string;
  value: string;
  review: boolean;
}

export interface Block {
  key: string;
  label: string;
  total: string;
  /** The meal's macros under its label ("P 37 · F 29 · C 136 g"); '' for "Other". */
  macros: string;
  lines: Line[];
}

/** "P 24 · F 3 · C 60 g": protein, fat and carbs in whole grams, as app. rounds them. */
export const macroText = (x: Nutrients) => `P ${n(x.protein)} · F ${n(x.fat)} · C ${n(x.carbs)} g`;

function foodLine(r: FoodRow): Line {
  return {
    ref: r.ref,
    time: r.time_known ? hm(r.at) : '',
    name: r.food,
    sub: r.portion_text || `${n(r.amount)} ${r.unit}`,
    macros: macroText(r.nutrients),
    value: `${n(r.nutrients.kcal)} kcal`,
    review: false,
  };
}

/** A value as the Health card writes it: "118/76 mmHg", "82.4 kg"; an event has none. */
export function valueText(v1: number | null, v2: number | null, unit: string | null): string {
  if (v1 === null) return '';
  const v = v2 === null ? plain(v1) : `${plain(v1)}/${plain(v2)}`;
  return unit ? `${v} ${unit}` : v;
}

function valueLine(r: ValueRow): Line {
  return {
    ref: r.ref,
    time: r.time_known ? hm(r.at) : '',
    name: r.label,
    sub: r.needs_review ? 'to review' : r.period && r.type !== 'bp' ? r.period : '',
    macros: '',
    value: valueText(r.v1, r.v2, r.unit),
    review: r.needs_review,
  };
}

/** A block's latest known time (ms), or null. */
const latest = (b: { rows: { at: string | null; time_known: boolean }[] }) =>
  b.rows.reduce<number | null>((m, r) => {
    const t = r.time_known && r.at ? Date.parse(r.at) : NaN;
    return Number.isNaN(t) || (m !== null && m >= t) ? m : t;
  }, null);

/** A block of rows: a meal (0 = the day's drinks) or null for entries that are not food. */
export interface RowBlock<R> {
  key: string;
  meal: number | null;
  rows: R[];
}

/**
 * Blocks newest first (the mockup): the drinks after the meals, blocks without a known time at the end; inside a block the
 * newest row first, rows without a known time last (the door sends known times first, in time order). Today's timeline and
 * the Food day (step E) both order their rows this way.
 */
export function newestFirst<R extends { at: string | null; time_known: boolean }>(blocks: RowBlock<R>[]): RowBlock<R>[] {
  const rank = (b: RowBlock<R>) => (b.meal === 0 ? 1 : latest(b) ? 0 : 2);
  return blocks
    .map((b, i) => ({ b, i }))
    .sort((x, y) => rank(x.b) - rank(y.b) || (latest(y.b) ?? 0) - (latest(x.b) ?? 0) || y.i - x.i)
    .map(({ b }) => {
      const known = b.rows.filter((r) => r.time_known && r.at).reverse();
      const unknown = b.rows.filter((r) => !(r.time_known && r.at));
      return { ...b, rows: [...known, ...unknown] };
    });
}

/**
 * The day's rows as blocks, newest first (the mockup): one block per meal with its label and kcal (energy.meals), the drinks last
 * (as app. lists them), and entries that are not food (mood, a tape measure, a nap) in "Other" blocks between the meals, where they
 * happened. Left out: the Health card's entries and the habit ticks, which have their own cards.
 */
export function timeline(d: Day): Block[] {
  const habits = new Set(d.habits.map((h) => h.name));
  const meals = new Map(d.energy.meals.map((m) => [m.meal, m]));
  const blocks: RowBlock<Row>[] = [];
  const byMeal = new Map<number, RowBlock<Row>>();
  for (const r of d.rows) {
    if (r.kind === 'food') {
      let b = byMeal.get(r.meal);
      if (!b) {
        b = { key: `meal-${r.meal}`, meal: r.meal, rows: [] };
        byMeal.set(r.meal, b);
        blocks.push(b);
      }
      b.rows.push(r);
    } else if (!HEALTH_TYPES.has(r.type) && !habits.has(r.type)) {
      const last = blocks.at(-1);
      if (last && last.meal === null) last.rows.push(r);
      else blocks.push({ key: `other-${r.ref}`, meal: null, rows: [r] });
    }
  }
  return newestFirst(blocks).map((b) => {
    const meal = b.meal === null ? undefined : meals.get(b.meal);
    return {
      key: b.key,
      label: b.meal === null ? 'Other' : mealLabel(b.meal, meal?.label),
      total: meal ? `${n(meal.nutrients.kcal)} kcal` : '',
      macros: meal ? macroText(meal.nutrients) : '',
      lines: b.rows.map((r) => (r.kind === 'food' ? foodLine(r) : valueLine(r))),
    };
  });
}

/** A meal's label as the door names it ("Meal 1", "Drinks"), or one made up when the door sent none. */
export const mealLabel = (meal: number, label: string | undefined) => label ?? (meal === 0 ? 'Drinks' : `Meal ${meal}`);

// ---- the Health card ----------------------------------------------------------------------------------------------------------

export interface HealthLine {
  row: HealthItem['row'];
  label: string;
  sub: string;
  value: string;
  time: string;
}

/** One line per row of the Health card: Bed and Woke up as times, the others as values with their unit; "–" for nothing logged. */
export function healthLines(d: Day): HealthLine[] {
  return d.health.map((h) => {
    const clock = h.row === 'bed' || h.row === 'wake';
    const subs = [h.sub ?? ''];
    if (h.row === 'wake' && h.ref && d.header.slept_minutes) subs.push(`slept ${hours(d.header.slept_minutes)}`);
    if (h.row === 'wake' && h.ref) subs.push(...d.header.naps.map((x) => `nap ${hours(x.minutes)}`));
    if (h.last_at) subs.push(`last ${hm(h.last_at)}`);
    const value = clock ? (h.ref && h.at ? hm(h.at) : '–') : h.v1 === null ? '–' : valueText(h.v1, h.v2, h.unit);
    return { row: h.row, label: h.label, sub: subs.filter(Boolean).join(' · '), value, time: clock ? '' : hm(h.at) };
  });
}

// ---- what needs you -----------------------------------------------------------------------------------------------------------

/**
 * The amber card's count: every open question, message not read yet and item to review, the check-in, and "Body measurements due"
 * (deploy 92: app. counts it with the items to review, todaypage._review_section).
 */
export function needsCount(d: Day): number {
  const x = d.needs;
  return x.questions.length + x.not_read.length + x.review.length + (x.checkin ? 1 : 0) + (x.body_due ? 1 : 0);
}

/** An item to review in words: "Weight 182.4 kg", "Fruit bar 40 g", "A task (personal)": a thought by its type, never its words. */
export function reviewText(r: Review): string {
  if (r.kind === 'thought') return `A ${r.thought_type ?? 'thought'}${r.area ? ` (${r.area})` : ''}`;
  if (r.kind === 'food') return `${r.label} ${n(r.v1)} ${r.unit ?? ''}`.trim();
  if (r.kind === 'measurement') return `${r.label} ${n(r.v1, 1)}${r.v2 !== null ? `/${n(r.v2)}` : ''} ${r.unit ?? ''}`.trim();
  return `${r.label}${r.at ? ` ${hm(r.at)}` : ''}`;
}

// ---- habits and chips ---------------------------------------------------------------------------------------------------------

/** "1/2": habits done of those to do; a habit to avoid is not counted (app.: "Habits · 1 of 2 done"). */
export function habitsDone(habits: Habit[]): string {
  const todo = habits.filter((h) => !h.avoid);
  return `${todo.filter((h) => h.complete).length}/${todo.length}`;
}

/** A chip's short name (todaypage.chip_names): without a bracket at the end, unless two chips would then read alike. */
export function chipNames(names: string[]): string[] {
  const short = names.map((x) => x.replace(/\s*\([^()]*\)\s*$/, '').trim() || x);
  const low = short.map((x) => x.toLowerCase());
  return short.map((x, i) => (low.filter((y) => y === x.toLowerCase()).length === 1 ? x : names[i]!));
}

// ---- saving in place (step C) -------------------------------------------------------------------------------------------------

/** Every save's answer (docs/API.md, "Saves"): what happened, in a short line, and the fresh day. */
export interface SaveAnswer {
  outcome: string;
  tone: 'ok' | 'warning';
  head: string;
  receipt: string[];
  notes: string[];
  reason: string | null;
  questions: Question[];
  read_back: string | null;
  confirm: null | { label: string; no_label: string };
  result: string | null;
  refill: null | { label: string; text: string };
  replayed: boolean;
  undo: Undo | null;
  day?: Day;
  /** A save of the Food day (step E) asks for the fresh food day instead ("view": "food"). */
  food_day?: FoodDay;
  /** A save of the Usual meals page (deploy 87): every usual meal, fresh ("view": "usual"). */
  usual?: Usual[];
  /** A save of the Health page (deploy 92): its days and charts ("view": "health") or the body card ("view": "body"). */
  health?: Health;
  body?: Body;
  /** A save of the Habits page (deploy 94): the habits read ("view": "habits", with "show"). */
  habits?: Habits;
  /** A save of the Gym's Workout page (deploy 96): the Workout read ("view": "gym"). */
  gym?: Workout;
  /** A save of the Gym's Plan part (deploy 97): the Plan read ("view": "gym_plan"); of the Exercises part: "gym_exercises". */
  gym_plan?: Plan;
  gym_exercises?: Exercises;
  /** A save of Home's Now page (deploy 99): the Now read ("view": "home"); of the Pick page: "home_pick". */
  home?: Now;
  home_pick?: HomePick;
  /** Deploy 100: Zones ("view": "home_zones"), History (with "view_limit"), Edit zones ("home_edit"). */
  home_zones?: Zones;
  home_history?: History;
  home_edit?: Edit;
  /** Deploy 109: a day coaching's start asks for the Coach page ("view": "coach", with "view_f"); the coaching it started (null when refused). */
  coach?: CoachRead;
  coaching?: { id: number; state: string } | null;
}

/** The rows a save added (in the fresh day, not in the one shown before): they get a blue edge (the mockup). */
export function freshRefs(before: Day, after: Day): Set<string> {
  const had = new Set(before.rows.map((r) => r.ref));
  return new Set(after.rows.filter((r) => !had.has(r.ref)).map((r) => r.ref));
}
