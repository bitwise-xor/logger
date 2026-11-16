/**
 * Today as the door sends it (GET /api/v1/day, docs/API.md) and what the page makes of it: the header line, kcal left, the timeline
 * with meal labels, the Health card's values, what needs you. Plain TypeScript, so the unit tests need no browser.
 */
import { dayOf, hm, hours, n, plain } from './format.js';

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
  needs: { questions: Question[]; not_read: NotRead[]; review: Review[]; checkin: Checkin | null };
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

// ---- Your day: one timeline with meal labels ----------------------------------------------------------------------------------

/** The Health card's types: their entries are on the card, not in the timeline (the plan, question 1). */
export const HEALTH_TYPES = new Set(['bed', 'wake', 'weight', 'blood_sugar', 'bp']);

export interface Line {
  ref: string;
  time: string;
  name: string;
  sub: string;
  value: string;
  review: boolean;
}

export interface Block {
  key: string;
  label: string;
  total: string;
  lines: Line[];
}

function foodLine(r: FoodRow): Line {
  const amount = r.portion_text || `${n(r.amount)} ${r.unit}`;
  return {
    ref: r.ref,
    time: r.time_known ? hm(r.at) : '',
    name: r.food,
    sub: `${amount} · ${n(r.nutrients.protein)} g protein`,
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
    value: valueText(r.v1, r.v2, r.unit),
    review: r.needs_review,
  };
}

/** A block's latest known time (ms), or null. */
const latest = (b: { rows: Row[] }) =>
  b.rows.reduce<number | null>((m, r) => {
    const t = r.time_known && r.at ? Date.parse(r.at) : NaN;
    return Number.isNaN(t) || (m !== null && m >= t) ? m : t;
  }, null);

/**
 * The day's rows as blocks, newest first (the mockup): one block per meal with its label and kcal (energy.meals), the drinks last
 * (as app. lists them), and entries that are not food (mood, a tape measure, a nap) in "Other" blocks between the meals, where they
 * happened. Left out: the Health card's entries and the habit ticks, which have their own cards.
 */
export function timeline(d: Day): Block[] {
  const habits = new Set(d.habits.map((h) => h.name));
  const meals = new Map(d.energy.meals.map((m) => [m.meal, m]));
  const blocks: { key: string; meal: number | null; rows: Row[] }[] = [];
  const byMeal = new Map<number, (typeof blocks)[number]>();
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
  // Newest block first; the drinks after the meals; blocks without a known time at the end.
  const rank = (b: (typeof blocks)[number]) => (b.meal === 0 ? 1 : latest(b) ? 0 : 2);
  const ordered = blocks
    .map((b, i) => ({ b, i }))
    .sort((x, y) => rank(x.b) - rank(y.b) || (latest(y.b) ?? 0) - (latest(x.b) ?? 0) || y.i - x.i)
    .map((x) => x.b);
  return ordered.map((b) => {
    const meal = b.meal === null ? undefined : meals.get(b.meal);
    // Newest first inside a block too; the door sends known times first, in time order.
    const known = b.rows.filter((r) => r.time_known && r.at).reverse();
    const unknown = b.rows.filter((r) => !(r.time_known && r.at));
    return {
      key: b.key,
      label: b.meal === null ? 'Other' : (meal?.label ?? (b.meal === 0 ? 'Drinks' : `Meal ${b.meal}`)),
      total: meal ? `${n(meal.nutrients.kcal)} kcal` : '',
      lines: [...known, ...unknown].map((r) => (r.kind === 'food' ? foodLine(r) : valueLine(r))),
    };
  });
}

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

/** The amber card's count: every open question, message not read yet and item to review, and the check-in. */
export function needsCount(d: Day): number {
  const x = d.needs;
  return x.questions.length + x.not_read.length + x.review.length + (x.checkin ? 1 : 0);
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
}

/** The rows a save added (in the fresh day, not in the one shown before): they get a blue edge (the mockup). */
export function freshRefs(before: Day, after: Day): Set<string> {
  const had = new Set(before.rows.map((r) => r.ref));
  return new Set(after.rows.filter((r) => !had.has(r.ref)).map((r) => r.ref));
}
