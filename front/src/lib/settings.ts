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
  /** The body measures in their order (web item 58: the owner's, from log_types); has_values: cannot be removed, only hidden. */
  measures: BodyMeasure[];
  limits: { label: { min: number; max: number }; landmark_max: number; cm: { min: number; max: number }; words_max: number; word_max: number };
  /** Suggested measures not added yet: quick fills for the add form. */
  suggestions: MeasureSuggestion[];
  hints: { height: string; measures: string; remove: string };
}

export interface MeasureSuggestion {
  label: string;
  landmark: string;
  min: number;
  max: number;
  words: string[];
}

export interface BodyMeasure extends MeasureSuggestion {
  key: string;
  shown: boolean;
  has_values: boolean;
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

/** A nudge of Settings > Notifications. after and hours are null for a switch alone (web item 57: "When the Home timer ends"). */
export interface Nudge {
  key: string;
  label: string;
  after: string | null;
  on: boolean;
  hours: { key: string; value: number; min: number; max: number; step: number; default: number } | null;
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

// ---- Settings > Body's measures (web item 58) ------------------------------------------------------------------------------------

/** A measure's form as typed: the words as one comma list. */
export interface MeasureDraft {
  label: string;
  landmark: string;
  min: string;
  max: string;
  words: string;
}

export const EMPTY_MEASURE: MeasureDraft = { label: '', landmark: '', min: '', max: '', words: '' };

/** The form filled from a measure (Edit) or a suggestion (its chip). */
export const measureDraft = (m: MeasureSuggestion): MeasureDraft => ({
  label: m.label,
  landmark: m.landmark,
  min: String(m.min),
  max: String(m.max),
  words: m.words.join(', '),
});

/** The small line under a measure's name: its landmark and its range ("Below the larynx · 25–60 cm"). */
export const measureLine = (m: Pick<MeasureSuggestion, 'landmark' | 'min' | 'max'>) => [m.landmark, `${m.min}–${m.max} cm`].filter(Boolean).join(' · ');

/** The words typed as a list: split at commas, lower case, the spaces tidied, each once. */
export function wordsList(t: string): string[] {
  const out: string[] = [];
  for (const w of t.split(',')) {
    const x = w.trim().split(/\s+/).join(' ').toLowerCase();
    if (x && !out.includes(x)) out.push(x);
  }
  return out;
}

/** A field of the range that is not a number, in the door's words (websettings._measure_form); the door checks the rest. */
export function measureProblem(d: MeasureDraft, cm: { min: number; max: number }): string | null {
  if (!isNumber(d.min)) return `Lowest: give a number from ${cm.min} to ${cm.max} cm.`;
  if (!isNumber(d.max)) return `Highest: give a number from ${cm.min} to ${cm.max} cm.`;
  return null;
}

/** The form's fields for POST /settings/body_measure: add, or edit by key. The measure's key is the field `measure` (`key` is the
 * page's re-send key, which a Yes in the answer bar takes away). */
export function measureFields(action: 'add' | 'edit', d: MeasureDraft, key?: string): FieldValues {
  return { action, ...(key ? { measure: key } : {}), label: d.label, landmark: d.landmark, min: d.min, max: d.max, words: d.words };
}

/** The body of POST /settings/body_measure from the form: by action its fields (docs/API.md); an unknown action sends none. */
export function measureBody(get: (name: string) => string | undefined): Record<string, unknown> {
  const action = get('action');
  const text = (name: string, most: number) => (get(name) ?? '').trim().slice(0, most);
  const key = text('measure', 64);
  const num = (name: string) => {
    const t = text(name, 20);
    return isNumber(t) ? Number(t.replace(',', '.')) : t === '' ? null : t;
  };
  if (action === 'add' || action === 'edit') {
    return { action, ...(action === 'edit' ? { key } : {}), label: text('label', 200), landmark: text('landmark', 1000),
      min: num('min'), max: num('max'), words: wordsList(text('words', 2000)).slice(0, 50) };
  }
  if (action === 'move') return { action, key, dir: get('dir') === 'up' ? 'up' : 'down' };
  if (action === 'remove') return { action, key };
  return {};
}

/** The Nudges form as typed: the master switch, and per row its switch and the hours as text (hoursKey null: a switch alone). */
export interface NudgesDraft {
  on: boolean;
  rows: { key: string; on: boolean; hoursKey: string | null; hours: string }[];
}

export const nudgesDraft = (n: SettingsNotify): NudgesDraft => ({
  on: n.on,
  rows: n.nudges.map((x) => ({ key: x.key, on: x.on, hoursKey: x.hours?.key ?? null, hours: x.hours ? String(x.hours.value) : '' })),
});

/** The form's fields for POST /settings/nudges: every switch "1" or "0" and every hours field as typed. */
export function nudgesFields(d: NudgesDraft): FieldValues {
  const f: FieldValues = { on: d.on ? '1' : '0' };
  for (const r of d.rows) {
    f[r.key] = r.on ? '1' : '0';
    if (r.hoursKey) f[r.hoursKey] = r.hours.trim();
  }
  return f;
}

/**
 * The body of POST /settings/nudges from the form, with the nudges the door listed (Web 70, 21.11.2026: GET /settings/notify read
 * just before, src/lib/server/saves.ts; before, the keys were written here, so a nudge the core adds later would show and not save):
 * the master switch, each listed nudge's switch (true or false) and its hours (a number). A field of a nudge the door did not list
 * is left out; a field left out stays as it is at the door. A nudge without hours (the Home timer's) sends its switch alone. -> the
 * body, or why it cannot be saved: hours outside the door's range.
 */
export function nudgesBody(get: (name: string) => string | undefined, listed: Pick<Nudge, 'key' | 'label' | 'hours'>[]): { body: Record<string, boolean | number>; problem: string | null } {
  const body: Record<string, boolean | number> = {};
  const flag = (name: string) => {
    const v = get(name);
    if (v !== undefined) body[name] = v === '1';
  };
  flag('on');
  for (const n of listed) {
    if (!SETTING_KEY.test(n.key) || (n.hours && !SETTING_KEY.test(n.hours.key))) continue;
    flag(n.key);
    if (!n.hours) continue;
    const typed = get(n.hours.key);
    const hours = hoursOf(typed);
    if (hours === undefined) continue; // not a number: stays as it is (the door's rule)
    if (hours < n.hours.min || hours > n.hours.max) {
      return { body, problem: `${n.label.replace(/[\s,;:.]+$/, '')}: give a number of hours from ${plainHours(n.hours.min)} to ${plainHours(n.hours.max)}.` };
    }
    body[n.hours.key] = hours;
  }
  return { body, problem: null };
}

/** A key the door may name a nudge or its hours by: lower-case words. */
const SETTING_KEY = /^[a-z][a-z0-9_]{0,39}$/;
const plainHours = (x: number) => String(x).replace(/\.0+$/, '');

/** An hours field as the door takes it: a number (a comma too); anything else is left out, so it stays as it is (the door clamps). */
export function hoursOf(t: string | undefined): number | undefined {
  const s = (t ?? '').trim();
  return /^\d{1,2}([.,]\d{1,2})?$/.test(s) ? Number(s.replace(',', '.')) : undefined;
}

// ---- the export ---------------------------------------------------------------------------------------------------------------

export const EXPORT_FAILED = 'The export could not be made. Nothing was downloaded; try again in a moment.';

/**
 * Core 37 (21.11.2026): the export with private and gratitude entries asks for the authenticator code (the door checks it as at a
 * sign-in: each code once, a wrong one a failed try of this device, the sign-in's limit). The door's refusals whose words the tab
 * shows: a wrong or missing code (403 `wrong_code`) and too many tries (429 `too_many_tries`).
 */
export const EXPORT_CODE_REFUSALS = new Set(['wrong_code', 'too_many_tries']);
/** The cookie that carries the door's words back to the tab for one read (download/+server.ts; never a query, which anyone could write). */
export const EXPORT_REFUSED_COOKIE = '__Host-logger-export-refused';

/** The code as typed, for the door: spaces taken out, at most 20 characters (the door checks it). */
export const exportCode = (v: unknown): string => (typeof v === 'string' ? v.replace(/\s+/g, '').slice(0, 20) : '');

/** The door's words as the tab shows them: one line, at most 300 characters; none when empty. */
export function refusedText(v: string | undefined | null): string | null {
  const t = (v ?? '').replace(/\s+/g, ' ').trim().slice(0, 300);
  return t || null;
}

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
