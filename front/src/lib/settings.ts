/**
 * Settings at logger. (deploy 111): the door's seven tabs (GET /api/v1/settings/<tab>, docs/API.md "Settings and notifications (110)")
 * and the plain rules the pages need: a Today page group moved or switched and posted whole, the forms' fields as the form actions
 * take them, the checks that keep a wrong kind of field from reaching the door (in app.'s words), the lines of a device and of a
 * device that gets nudges, and the export's download headers. Plain TypeScript, so the tests need no browser.
 */
import type { FieldValues } from './saver.js';

// ---- the reads ----------------------------------------------------------------------------------------------------------------

export interface TargetField {
  key: string;
  label: string;
  unit: string;
  value: number | null;
}

export interface SettingsTargets {
  valid_from: string;
  current: null | { valid_from: string; valid_from_text: string; note: string | null };
  fields: TargetField[];
  history: { valid_from: string; valid_from_text: string; values: Record<string, number | null>; note: string | null }[];
  limits: { min: number; max: number; note_max: number };
  hint: string;
}

export type TodayKind = 'habit' | 'health' | 'usual' | 'review' | 'card';
export interface TodayItem {
  id: string;
  label: string;
  shown: boolean;
}
export interface TodayGroup {
  kind: TodayKind;
  heading: string;
  items: TodayItem[];
}
export interface SettingsToday {
  groups: TodayGroup[];
  hint: string;
}

export interface SettingsBody {
  valid_from: string;
  height: null | { cm: number; valid_from: string };
  heights: { cm: number; valid_from: string; valid_from_text: string }[];
  height_range: { min: number; max: number };
  interval: { days: number; min: number; max: number; default: number };
  measures: { key: string; label: string; shown: boolean }[];
  hints: { height: string; measures: string };
}

export interface CoachPart {
  key: string;
  label: string;
  on: boolean;
}
export interface SettingsCoach {
  goals: string;
  style: string;
  max: number;
  kinds: { kind: 'day' | 'week'; title: string; parts: CoachPart[] }[];
  facts: string[];
  model: string;
  daily_limit: number;
}

export type Address = 'logger' | 'app';
export interface Device {
  id: string;
  name: string;
  address: Address;
  signed_in: string;
  last_used: string;
  expires: string;
  current: boolean;
}
export interface SettingsDevices {
  devices: Device[];
  others: number;
}

export interface Nudge {
  key: string;
  label: string;
  after: string;
  on: boolean;
  hours: { key: string; value: number; min: number; max: number; step: number; default: number };
  note: string | null;
}
export interface Subscription {
  id: number;
  name: string;
  address: Address;
  on_since: string;
  last_delivered: string | null;
  this: boolean;
}
export interface SettingsNotify {
  on: boolean;
  on_label: string;
  nudges: Nudge[];
  awake_hours: number;
  subscriptions: Subscription[];
  public_key: string | null;
  twice: boolean;
}

export interface SettingsExport {
  title: string;
  intro: string;
  private_label: string;
  button: string;
  hint: string;
  last: null | { at: string; private: boolean; text: string };
}

// ---- dates and lines ----------------------------------------------------------------------------------------------------------

const DATE = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Berlin', day: '2-digit', month: '2-digit', year: 'numeric' });
const CLOCK = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

/** "17.11.2026" for a moment (Berlin's calendar) or a day as the door sends it ("2026-11-17"); "" for none. */
export function dateText(iso: string | null | undefined): string {
  if (!iso) return '';
  const at = new Date(/^\d{4}-\d\d-\d\d$/.test(iso) ? `${iso}T12:00:00Z` : iso);
  if (Number.isNaN(at.getTime())) return '';
  const p = Object.fromEntries(DATE.formatToParts(at).map((x) => [x.type, x.value]));
  return `${p.day}.${p.month}.${p.year}`;
}

/** "17.11.2026 12:58" for a moment; "" for none. */
export function whenText(iso: string | null | undefined): string {
  const d = dateText(iso);
  return d && iso ? `${d} ${CLOCK.format(new Date(iso))}` : '';
}

/** The small tag of an address: "logger." or "app.". */
export const addressTag = (a: Address) => (a === 'logger' ? 'logger.' : 'app.');

/** A device's line, as app.'s Settings > Devices: "signed in 17.11.2026 · last used 17.11.2026 12:58 · stays signed in until 17.12.2026". */
export const deviceLine = (d: Pick<Device, 'signed_in' | 'last_used' | 'expires'>) =>
  `signed in ${dateText(d.signed_in)} · last used ${whenText(d.last_used)} · stays signed in until ${dateText(d.expires)}`;

/** A device that gets nudges: "on since 17.11.2026, last delivered 17.11.2026 09:58" (or "nothing delivered yet"). */
export const pushLine = (s: Pick<Subscription, 'on_since' | 'last_delivered'>) =>
  `on since ${dateText(s.on_since)}, ${s.last_delivered ? `last delivered ${whenText(s.last_delivered)}` : 'nothing delivered yet'}`;

/** The door's twice: the same device name is on here and at app. */
export const TWICE_LINE = 'This phone is on at app. too: nudges arrive twice until you turn that one off.';

// ---- Today page: one tap posts its whole group ---------------------------------------------------------------------------------

/** Whether a row can move up (-1) or down (+1) in its group. */
export const canMove = (items: readonly unknown[], i: number, dir: -1 | 1) => i + dir >= 0 && i + dir < items.length && i >= 0 && i < items.length;

/** The group with row i moved one place up (-1) or down (+1); the same order when it cannot move. */
export function moved<T>(items: readonly T[], i: number, dir: -1 | 1): T[] {
  const next = [...items];
  if (!canMove(items, i, dir)) return next;
  [next[i], next[i + dir]] = [next[i + dir]!, next[i]!];
  return next;
}

/** The group with row i switched (shown ↔ hidden). */
export const switched = (items: readonly TodayItem[], i: number): TodayItem[] => items.map((x, k) => (k === i ? { ...x, shown: !x.shown } : x));

/** The form's fields for POST /settings/today: the group's kind, its ids in the wanted order and each one's shown ("1" or "0"). */
export function groupFields(kind: TodayKind, items: readonly TodayItem[]): FieldValues {
  return { group: kind, id: items.map((x) => x.id), shown: items.map((x) => (x.shown ? '1' : '0')) };
}

// ---- the forms ----------------------------------------------------------------------------------------------------------------

/** A number as typed: digits with a point or comma, a minus allowed (the door says the range in its words). */
const NUMBER = /^-?\d{1,9}([.,]\d{1,6})?$/;
export const isNumber = (t: string) => NUMBER.test(t.trim());

/** Food targets: the first field typed that is not a number, in app.'s words (websettings._number); null when all can go. */
export function targetsProblem(fields: readonly TargetField[], typed: Record<string, string>, limits: { min: number; max: number }): string | null {
  for (const f of fields) {
    const t = (typed[f.key] ?? '').trim();
    if (t !== '' && !isNumber(t)) return `${f.label}: give a number from ${limits.min} to ${limits.max}, or leave it empty.`;
  }
  return null;
}

/** Height: not a number, in app.'s words. */
export const heightProblem = (t: string, r: { min: number; max: number }) =>
  isNumber(t) ? null : `Height: give a number from ${r.min} to ${r.max} cm.`;

/** Due every: not a whole number, in app.'s words. */
export const intervalProblem = (t: string, r: { min: number; max: number }) =>
  /^\d{1,4}$/.test(t.trim()) ? null : `Due every: give a whole number of days from ${r.min} to ${r.max}.`;

/** The Nudges form as typed: the master switch, and per row its switch and the hours as text. */
export interface NudgesDraft {
  on: boolean;
  rows: { key: string; on: boolean; hoursKey: string; hours: string }[];
}

export const nudgesDraft = (n: SettingsNotify): NudgesDraft => ({
  on: n.on,
  rows: n.nudges.map((x) => ({ key: x.key, on: x.on, hoursKey: x.hours.key, hours: String(x.hours.value) })),
});

/** The form's fields for POST /settings/nudges: every switch "1" or "0" and every hours field as typed. */
export function nudgesFields(d: NudgesDraft): FieldValues {
  const f: FieldValues = { on: d.on ? '1' : '0' };
  for (const r of d.rows) {
    f[r.key] = r.on ? '1' : '0';
    f[r.hoursKey] = r.hours.trim();
  }
  return f;
}

/** The nudges' switches, and their hours fields (the door's names: weight_after, idle_hours, …). */
export const NUDGE_KEYS = ['weight', 'habits', 'idle', 'checkin', 'bp_evening', 'gratitude'] as const;
export const NUDGE_HOURS = ['weight_after', 'habits_after', 'idle_hours', 'checkin_after', 'bp_evening_after', 'gratitude_after'] as const;

/** An hours field as the door takes it: a number (a comma too); anything else is left out, so it stays as it is (the door clamps). */
export function hoursOf(t: string | undefined): number | undefined {
  const s = (t ?? '').trim();
  return /^\d{1,2}([.,]\d{1,2})?$/.test(s) ? Number(s.replace(',', '.')) : undefined;
}

// ---- the export ---------------------------------------------------------------------------------------------------------------

export const EXPORT_FAILED = 'The export could not be made. Nothing was downloaded; try again in a moment.';

/**
 * The download's headers, from the door's answer: its Content-Type (a ZIP only) and Content-Disposition (an attachment with a plain
 * file name only), and no-store. null: not a file this app hands on (the endpoint then goes back to the tab with EXPORT_FAILED).
 */
export function downloadHeaders(contentType: string | null, disposition: string | null): Record<string, string> | null {
  if (!contentType || !/^application\/zip(\s*;.*)?$/i.test(contentType.trim())) return null;
  const cd = (disposition ?? '').trim();
  const safe = /^attachment;\s*filename="[A-Za-z0-9._-]{1,100}"$/.test(cd) ? cd : 'attachment; filename="logger-export.zip"';
  return { 'Content-Type': 'application/zip', 'Content-Disposition': safe, 'Cache-Control': 'no-store' };
}
