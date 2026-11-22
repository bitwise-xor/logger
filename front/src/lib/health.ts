/**
 * The Health page (deploy 92; the door's routes came with deploy 91): the door's Health and Body shapes (docs/API.md) and what the
 * page makes of them: what a day's row shows, the fields of a day's row to change, which of them changed and the door's body of
 * a save, the Body measurements card's lines, and Today's "Body measurements due" line. Plain TypeScript, so the tests need no
 * browser; the charts are drawn by the chart part (src/lib/chart.ts, components/chart/).
 */
import type { ChartData, ClockRows } from './chart.js';
import { dayOf } from './format.js';

export const RANGES = [7, 30, 90] as const;
export type Range = (typeof RANGES)[number];

export type RowName = 'weight' | 'bp_morning' | 'bp_evening' | 'sugar' | 'bed' | 'wake' | 'mood' | 'energy';
/** The rows in the door's order; their kind: a number, a pair (blood pressure: upper, lower) or a time hh:mm. */
export const ROWS: { row: RowName; kind: 'number' | 'pair' | 'time' }[] = [
  { row: 'weight', kind: 'number' },
  { row: 'bp_morning', kind: 'pair' },
  { row: 'bp_evening', kind: 'pair' },
  { row: 'sugar', kind: 'number' },
  { row: 'bed', kind: 'time' },
  { row: 'wake', kind: 'time' },
  { row: 'mood', kind: 'number' },
  { row: 'energy', kind: 'number' },
];
const KIND = new Map(ROWS.map((r) => [r.row, r.kind]));

export interface HValue {
  ref: string;
  v1: number | null;
  v2: number | null;
  time: string | null;
  at: string | null;
}

export interface HealthDay {
  day: string;
  values: Record<RowName, HValue | null>;
  slept_minutes: number | null;
}

export interface Column {
  row: RowName;
  label: string;
  sub: string | null;
  type: string;
  period: string | null;
  kind: 'number' | 'pair' | 'time';
}

/** A chart card of the door: its title, the grey words after it, the line under it in parts, the chart, the colour keys. */
export interface ChartCard {
  id: string;
  title: string;
  small: string | null;
  stat: { text: string; bold: boolean }[];
  chart: ChartData;
  legend: { key: string; text: string }[];
}

export interface Times extends ClockRows {
  title: string;
  small: string | null;
  legend: { key: string; text: string }[];
}

export interface Health {
  today: string;
  start: string;
  range: number;
  ranges: number[];
  all: boolean;
  days_in_range: number;
  shown_days: number;
  oldest_day: string;
  columns: Column[];
  days: HealthDay[];
  charts: ChartCard[];
  times: Times;
}

/** A body measure's key (log_types.name): the measures are the door's (Settings > Body, web item 58), never a list written here. */
export type MeasureKey = string;

export interface Body {
  today: string;
  day: string;
  last_measured: string | null;
  due_text: string | null;
  interval_days: number;
  hidden: string[];
  jump_cm: number;
  protocol: string;
  hint: string;
  form: { key: MeasureKey; label: string; hint: string; ref: string | null; cm: number | null; last_cm: number | null; min: number; max: number }[];
  table: { key: MeasureKey; label: string; ref: string; cm: number; day: string; last: number | null; start: number | null; last_text: string | null; start_text: string | null }[];
  first_day: string | null;
  charts: { key: MeasureKey; label: string; chart: ChartData }[];
  waist_height: null | { waist_cm: number; day: string; height_cm: number | null; ratio: number | null };
  weight_rate: null | { kg_week: number; pct_week: number; sign: string };
}

/** The range asked for in the address (?range=): 7, 30 or 90, else the door's default (30). */
export function askedRange(v: string | null): Range {
  const r = Number(v);
  return (RANGES as readonly number[]).includes(r) ? (r as Range) : 30;
}

/** A day in the address (yyyy-mm-dd), or none. */
export const askedDay = (v: string | null) => (v && /^\d{4}-\d\d-\d\d$/.test(v) ? v : undefined);

/** The page's address: the range, "Show all", the body form open on a session (#body brings the card into view). */
export function healthHref(range: number, opts: { all?: boolean; measure?: boolean; mday?: string | null } = {}): string {
  const q = new URLSearchParams({ range: String(range) });
  if (opts.all) q.set('all', '1');
  if (opts.measure) q.set('measure', '1');
  if (opts.measure && opts.mday) q.set('mday', opts.mday);
  return `/health?${q}${opts.measure ? '#body' : ''}`;
}

// ---- a day's row --------------------------------------------------------------------------------------------------------------

/** A number as typed and as app. writes it in its fields (healthpage.plain): no trailing zeros ("81.6", "118"). */
export const plainNum = (v: number | null | undefined) => (v === null || v === undefined ? '' : String(+v));

/** "8 h 00": a night's sleep as app.'s Entries table writes it; "–" without one. */
export function sleptText(minutes: number | null): string {
  if (minutes === null || minutes <= 0 || minutes >= 24 * 60) return '–';
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')}`;
}

/** One value as a row shows it: "81.6", "118/77", "22:00"; "–" for none. */
export function valueOf(kind: Column['kind'], v: HValue | null): string {
  if (!v) return '–';
  if (kind === 'time') return v.time ?? '–';
  if (kind === 'pair') return v.v1 === null ? '–' : `${plainNum(v.v1)}/${plainNum(v.v2)}`;
  return plainNum(v.v1) || '–';
}

export interface DayLine {
  day: string;
  /** "Mon 16.11." */
  label: string;
  /** The values there are, in the door's order, as "Weight 81.6 kg", "BP morning 118/77" (a closed row on a phone). */
  parts: { row: RowName; text: string }[];
  slept: string;
  /** Every column's value, as the table shows it ("–" for none). */
  cells: { row: RowName; text: string }[];
  empty: boolean;
}

const UNIT: Partial<Record<RowName, string>> = { weight: ' kg' };
const SHORT: Record<RowName, string> = {
  weight: 'Weight',
  bp_morning: 'BP morning',
  bp_evening: 'BP evening',
  sugar: 'Sugar',
  bed: 'Bed',
  wake: 'Up',
  mood: 'Mood',
  energy: 'Energy',
};

/** What a day's row shows: the date, the values there are, the computed sleep. */
export function dayLine(d: HealthDay, columns: Column[]): DayLine {
  const cells = columns.map((c) => ({ row: c.row, text: valueOf(c.kind, d.values[c.row] ?? null) }));
  const parts = cells.filter((c) => c.text !== '–').map((c) => ({ row: c.row, text: `${SHORT[c.row]} ${c.text}${UNIT[c.row] ?? ''}` }));
  return { day: d.day, label: dayOf(d.day), parts, slept: sleptText(d.slept_minutes), cells, empty: parts.length === 0 };
}

/** The field names of a day's row: one per row, two for a blood pressure (upper and lower). */
export const FIELDS: string[] = ROWS.flatMap((r) => (r.kind === 'pair' ? [`${r.row}_1`, `${r.row}_2`] : [r.row]));

export type Draft = Record<string, string>;

/** A day's values as the fields of its row show them, to change. */
export function draftOf(d: HealthDay): Draft {
  const out: Draft = {};
  for (const { row, kind } of ROWS) {
    const v = d.values[row] ?? null;
    if (kind === 'pair') {
      out[`${row}_1`] = plainNum(v?.v1);
      out[`${row}_2`] = plainNum(v?.v2);
    } else out[row] = kind === 'time' ? (v?.time ?? '') : plainNum(v?.v1);
  }
  return out;
}

const tidy = (s: string | undefined) => (s ?? '').trim().replace(',', '.');
/** Two typed numbers are the same value ("81.60" and "81.6"); anything else is compared as typed. */
function same(a: string | undefined, b: string | undefined): boolean {
  const [x, y] = [tidy(a), tidy(b)];
  if (x === y) return true;
  return x !== '' && y !== '' && !Number.isNaN(Number(x)) && Number(x) === Number(y);
}

/** The rows whose fields differ from the day's values, in the door's order. */
export function changedRows(before: Draft, now: Draft): RowName[] {
  return ROWS.filter(({ row, kind }) =>
    kind === 'pair' ? !same(before[`${row}_1`], now[`${row}_1`]) || !same(before[`${row}_2`], now[`${row}_2`]) : !same(before[row], now[row]),
  ).map((r) => r.row);
}

/** The fields a Save sends: only the changed rows (the door looks only at the rows sent), both numbers of a blood pressure. */
export function saveFields(before: Draft, now: Draft): Record<string, string> {
  const out: Record<string, string> = {};
  for (const row of changedRows(before, now)) {
    for (const f of KIND.get(row) === 'pair' ? [`${row}_1`, `${row}_2`] : [row]) out[f] = tidy(now[f]);
  }
  return out;
}

/** Whether a Save clears a value that is there (the door asks once: "Delete on …?"). */
export function clears(before: Draft, now: Draft): boolean {
  return changedRows(before, now).some((row) =>
    KIND.get(row) === 'pair'
      ? tidy(now[`${row}_1`]) === '' && tidy(now[`${row}_2`]) === '' && (tidy(before[`${row}_1`]) !== '' || tidy(before[`${row}_2`]) !== '')
      : tidy(now[row]) === '' && tidy(before[row]) !== '',
  );
}

// ---- the door's bodies (the server side of the form actions) ----------------------------------------------------------------

/** The form's fields: what FormData offers (and a plain test double). */
interface Fields {
  get(name: string): FormDataEntryValue | null;
}

const field = (f: Fields, name: string, most = 20): string | null => {
  const v = f.get(name);
  return typeof v === 'string' ? v.trim().slice(0, most) : null;
};

/** A typed number as the door takes it: "81,6" is 81.6; empty is null (a delete); anything else as typed (the door says what is wrong). */
function num(t: string): number | string | null {
  if (t === '') return null;
  const x = t.replace(',', '.');
  return /^-?\d{1,6}(\.\d{1,3})?$/.test(x) ? Number(x) : t;
}

/** POST /health/day's `values` from the fields sent: only the rows there are (docs/API.md). */
export function healthValues(f: Fields): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const { row, kind } of ROWS) {
    if (kind === 'pair') {
      const [a, b] = [field(f, `${row}_1`), field(f, `${row}_2`)];
      if (a === null && b === null) continue;
      out[row] = (a ?? '') === '' && (b ?? '') === '' ? null : [num(a ?? ''), num(b ?? '')];
      continue;
    }
    const t = field(f, row);
    if (t === null) continue;
    out[row] = kind === 'time' ? t || null : num(t);
  }
  return out;
}

/** The body form's field of a measure: `cm_<key>`, so a measure's key never meets the form's own fields (day, clears, …). */
export const cmField = (key: string) => `cm_${key}`;
/** The form's list of its measures (`measures`, comma-separated keys as the door sent them in the form). */
export const MEASURES_FIELD = 'measures';
const KEY = /^[a-z0-9_]{1,40}$/;

/** POST /body's `values`: the measures the form lists, in cm, those with a field (empty = a delete). */
export function bodyValues(f: Fields): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const keys = (field(f, MEASURES_FIELD, 2000) ?? '').split(',').filter((k) => KEY.test(k)).slice(0, 50);
  for (const k of keys) {
    const t = field(f, cmField(k));
    if (t !== null) out[k] = num(t);
  }
  return out;
}

/** The body form's fields for a save: the changed values under their `cm_` names and the list of the form's measures. */
export function bodyPost(b: Pick<Body, 'form'>, changed: Record<string, string>): Record<string, string> {
  return { [MEASURES_FIELD]: b.form.map((m) => m.key).join(','), ...Object.fromEntries(Object.entries(changed).map(([k, v]) => [cmField(k), v])) };
}

// ---- the Body measurements card -------------------------------------------------------------------------------------------------

/** "16.11.2026" for yyyy-mm-dd. */
export const dmy = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;

/** A cm value as app. writes it (body.cm): one decimal ("92.0"). */
export const cm = (v: number) => v.toFixed(1);

/** The line under the card's title. */
export function bodySub(b: Body): string {
  return b.last_measured
    ? `Last measured ${dmy(b.last_measured)} · ${b.due_text}`
    : 'No measurements yet. About 3 minutes with a tape measure, every 4 weeks.';
}

/** The body form's fields: the session's values (empty where there is none). */
export function bodyDraft(b: Body): Draft {
  return Object.fromEntries(b.form.map((m) => [m.key, m.cm === null ? '' : cm(m.cm)]));
}

/** The measures a Save sends: only those changed (the door looks only at the measures sent). */
export function bodyFields(before: Draft, now: Draft): Record<string, string> {
  return Object.fromEntries(Object.keys(now).filter((k) => !same(before[k] ?? '', now[k])).map((k) => [k, tidy(now[k])]));
}

/** Waist ÷ height in words, or "add your height" (the link to app.'s Settings is the page's). */
export function waistHeight(b: Body): null | { ratio: string; height: string } | { noHeight: true } {
  const w = b.waist_height;
  if (!w) return null;
  if (w.height_cm === null || w.ratio === null) return { noHeight: true };
  return { ratio: (w.waist_cm / w.height_cm).toFixed(2), height: String(+w.height_cm) };
}

/** "+0.26 kg" and "+0.32 %": the weekly weight rate as app. writes it. */
export function weightRate(b: Body): null | { kg: string; pct: string } {
  const r = b.weight_rate;
  if (!r) return null;
  return { kg: `${r.sign}${Math.abs(r.kg_week).toFixed(2)} kg`, pct: `${r.sign}${Math.abs(r.pct_week).toFixed(2)} %` };
}

// ---- Today's line ---------------------------------------------------------------------------------------------------------------

export interface BodyDue {
  last: string | null;
  days: number | null;
}

/** Today's "Body measurements due" line (app.'s bodypage.today_line): its head and the small line under it. */
export function bodyDueLine(due: BodyDue): { head: string; sub: string } {
  if (due.last) {
    return { head: 'Body measurements due', sub: `Last ${due.last.slice(8, 10)}.${due.last.slice(5, 7)}. · ${due.days} days ago · takes about 3 minutes` };
  }
  return { head: 'Body measurements', sub: 'not measured yet · takes about 3 minutes' };
}
