/**
 * The Habits page (deploy 94; the door's routes came with deploy 93): the door's Habits shape (docs/API.md) and what the page
 * makes of it: "n of N done", the strip of 30 squares, the calendar of one habit in weeks (Monday first) and what a cell shows,
 * the filter with its counts, a habit's row and the actions the read allows, and the body of each form (a day tick, track, edit,
 * retire, bring back, delete, a new habit). Plain TypeScript, so the tests need no browser.
 */
import type { FieldValues } from './saver.js';

export const SHOWS = ['tracked', 'untracked', 'retired', 'all'] as const;
export type Show = (typeof SHOWS)[number];

/** The filter asked for in the address (?show=); tracked without, or when it is not one of the four. */
export function askedShow(raw: string | null | undefined): Show {
  return SHOWS.find((s) => s === raw) ?? 'tracked';
}

/** The page's address for a filter (tracked is the plain address); `base`: the Habits page, or Library's Habits tab (deploy 105). */
export function habitsHref(show: Show, base = '/habits'): string {
  return show === 'tracked' ? base : `${base}?show=${show}`;
}

export interface ChecklistHabit {
  name: string;
  label: string;
  done: number;
  target: number;
  complete: boolean;
  avoid: boolean;
  /** The tick an untick removes; none without one today. */
  last_tick: string | null;
}

export type DayState = 'done' | 'partly' | 'none' | 'logged';

export interface CalDay {
  day: string;
  n: number;
  state: DayState;
  text: string;
}

export interface CalHabit {
  name: string;
  label: string;
  target: number;
  avoid: boolean;
  /** The days done (a habit to avoid: the days without). */
  full: number;
  editable: boolean;
  days: CalDay[];
}

export interface ListHabit {
  name: string;
  label: string;
  group: string;
  target: number;
  order: number;
  /** Hours after waking at which the phone reminds of this habit while it is open today; null: no reminder of its own. */
  remind_after: number | null;
  avoid: boolean;
  state: 'tracked' | 'untracked' | 'retired';
  ticks: number;
  days30: number;
  last_day: string | null;
  stats: string;
  can_track: boolean;
  can_delete: boolean;
}

export interface Habits {
  today: string;
  start: string;
  days: number;
  /** The oldest day a save changes. */
  edit_from: string;
  checklist: { done: number; total: number; habits: ChecklistHabit[] };
  calendar: CalHabit[];
  show: Show;
  help: string;
  shows: { key: Show; label: string; count: number }[];
  list: { group: string; label: string; habits: ListHabit[] }[];
  groups: { key: string; label: string }[];
  default_group: string;
  limits: {
    label_max: number;
    target_min: number;
    target_max: number;
    order_max: number;
    remind_min: number;
    remind_max: number;
    remind_step: number;
  };
}

// ---- today's ticks -----------------------------------------------------------------------------------------------------------

/** "2 of 4 done": a habit to avoid is not counted (the door counts them out). */
export const doneLine = (h: Habits) => `${h.checklist.done} of ${h.checklist.total} done`;

/** A tick's form: tick when the habit is not complete, else take off its last tick (as Today's card). */
export function tickFields(h: ChecklistHabit): FieldValues {
  return h.complete && h.last_tick ? { name: h.name, action: 'untick', ref: h.last_tick } : { name: h.name, action: h.complete ? 'untick' : 'tick' };
}

// ---- the last 30 days ---------------------------------------------------------------------------------------------------------

/** "23/30", or "26/30 without" for a habit to avoid. */
export const fullText = (c: CalHabit) => `${c.full}/${c.days.length}${c.avoid ? ' without' : ''}`;

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;
export const WEEK_HEAD = WEEKDAYS;

/** 0 for a Monday to 6 for a Sunday. */
export function weekdayOf(iso: string): number {
  const d = new Date(`${iso}T12:00:00Z`).getUTCDay(); // 0 = Sunday
  return (d + 6) % 7;
}

/** "Mon 16.11." (the hover text, as app.). */
export const dayName = (iso: string) => `${WEEKDAYS[weekdayOf(iso)]} ${iso.slice(8, 10)}.${iso.slice(5, 7)}.`;

/**
 * The days laid out in weeks, Monday first, seven cells a week: the first week starts with empty cells (null) before the first
 * day, the last one ends with empty cells after the last. The days are the read's, oldest first; none is added.
 */
export function weeks(days: CalDay[]): (CalDay | null)[][] {
  if (!days.length) return [];
  const cells: (CalDay | null)[] = [...Array<null>(weekdayOf(days[0]!.day)).fill(null), ...days];
  while (cells.length % 7) cells.push(null);
  const out: (CalDay | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) out.push(cells.slice(i, i + 7));
  return out;
}

/** The small number in a cell: the day of the month, with the month on the first cell and on the 1st ("1 Nov"). */
export function cellNumber(iso: string, first: boolean): string {
  const d = String(Number(iso.slice(8, 10)));
  return first || d === '1' ? `${d} ${MONTHS[Number(iso.slice(5, 7)) - 1]}` : d;
}

/**
 * What a cell shows: a habit done once a day a tick; one that is done more often than once a day (or partly) "n/target"; a day
 * of a habit to avoid that it happened a cross (with the count above one); nothing for a day with nothing.
 */
export function cellMark(d: CalDay, c: Pick<CalHabit, 'target' | 'avoid'>): string {
  if (c.avoid) return d.n > 0 ? (d.n > 1 ? `✕${d.n}` : '✕') : '';
  if (d.n <= 0) return '';
  if (c.target > 1) return `${d.n}/${c.target}`;
  return '✓';
}

/** The day is done (or, for a habit to avoid, it happened): a tap takes its ticks off; else a tap adds one. */
export const isFull = (d: CalDay, c: Pick<CalHabit, 'target'>) => d.n >= Math.max(1, c.target);

/** A cell's words for a screen reader and the hover: "Stretching Mon 16.11.: done, tap to take the ticks off". */
export function cellLabel(c: CalHabit, d: CalDay): string {
  const what = !c.editable ? '' : isFull(d, c) ? ', tap to take the ticks off' : ', tap to tick';
  return `${c.label} ${dayName(d.day)}: ${d.text}${what}`;
}

/** A day the door changes: from the oldest day it takes up to today. */
export const canChange = (h: Pick<Habits, 'edit_from' | 'today'>, iso: string) => iso >= h.edit_from && iso <= h.today;

/** Why a calendar is read-only (the read marks it not editable), or none. */
export function readOnlyWhy(c: CalHabit): string | null {
  return c.editable ? null : 'Its days cannot be changed here: this is a time, not a habit to tick.';
}

/** A day's tick form. */
export const dayFields = (c: Pick<CalHabit, 'name'>, iso: string): FieldValues => ({ name: c.name, day: iso });

// ---- your habits ---------------------------------------------------------------------------------------------------------------

/** The filter's chips with their counts ("Tracked · 5"). */
export function chips(h: Habits, base = '/habits'): { key: Show; text: string; href: string; current: boolean }[] {
  return h.shows.map((s) => ({ key: s.key, text: `${s.label} · ${s.count}`, href: habitsHref(s.key, base), current: s.key === h.show }));
}

/** A group's title with its number of habits ("Intake · 1"). */
export const groupTitle = (g: Habits['list'][number]) => `${g.label} · ${g.habits.length}`;

/** The small line under a habit's name: "Practice · 2 times a day". */
export function rowLine(h: ListHabit, groups: Habits['groups']): string {
  const group = groups.find((g) => g.key === h.group)?.label ?? h.group;
  return `${group} · ${h.target} ${h.target === 1 ? 'time' : 'times'} a day`;
}

/** The actions of a row as the read allows them. */
export function rowActions(h: ListHabit) {
  return {
    track: h.can_track ? (h.state === 'tracked' ? ('untrack' as const) : ('track' as const)) : null,
    edit: true,
    retire: h.state !== 'retired',
    restore: h.state === 'retired',
    delete: h.can_delete,
  };
}

/**
 * The line under the filter (deploy 96): the door's words (app.'s HELP), but app.'s "in the calendar below" is worded for this page,
 * where the calendar is the "Last 30 days" card, above the list on phones and to its left on the PC.
 */
export const helpText = (h: Pick<Habits, 'help' | 'days'>, where = `in Last ${h.days} days`) => h.help.replace('in the calendar below', where);
/** Library's Habits tab (deploy 105) has no calendar: the line points to the Habits page. */
export const LIBRARY_WHERE = 'on the Habits page';

/** The names whose row is new or different in the fresh list (they get a blue edge). */
export function changedNames(before: Habits | null, after: Habits): Set<string> {
  const was = new Map(before?.list.flatMap((g) => g.habits).map((h): [string, string] => [h.name, JSON.stringify(h)]));
  return new Set(after.list.flatMap((g) => g.habits).filter((h) => was.get(h.name) !== JSON.stringify(h)).map((h) => h.name));
}

// ---- the forms ---------------------------------------------------------------------------------------------------------------------

/** What the Edit and New forms hold: text as typed (numbers too, so a half-typed value is kept). */
export interface Draft {
  label: string;
  target: string;
  order: string;
  /** The reminder's hours after waking as typed; empty: none. */
  remind: string;
  aim: 'do' | 'avoid';
  group: string;
  track: boolean;
}

export const editDraft = (h: ListHabit): Draft => ({
  label: h.label,
  target: String(h.target),
  order: String(h.order),
  remind: h.remind_after === null ? '' : String(h.remind_after),
  aim: h.avoid ? 'avoid' : 'do',
  group: h.group,
  track: false,
});

export const newDraft = (h: Pick<Habits, 'default_group'>): Draft => ({ label: '', target: '1', order: '', remind: '', aim: 'do', group: h.default_group, track: true });

/** Spaces tidied as the door tidies them: runs of spaces become one, none at the ends. */
export const tidy = (s: string) => s.split(/\s+/).filter(Boolean).join(' ');

const whole = (s: string) => (/^\d{1,6}$/.test(s.trim()) ? Number(s.trim()) : null);

/** The reminder as a number, or null when it is empty or not a number ("2,5" is 2.5). */
export const remindValue = (s: string): number | null => {
  const t = s.trim().replace(',', '.');
  return /^\d{1,3}(\.\d{1,3})?$/.test(t) ? Number(t) : null;
};

/** A check before sending, in the door's words where it has them; none when the form can go. */
export function problem(d: Draft, limits: Habits['limits'], isNew: boolean): string | null {
  const label = tidy(d.label);
  if (!label) return 'A habit needs a name to show.';
  if (label.length > limits.label_max) return `The name can have up to ${limits.label_max} characters.`;
  const t = whole(d.target);
  if (t === null || t < limits.target_min || t > limits.target_max) return `Times a day: a whole number from ${limits.target_min} to ${limits.target_max}.`;
  if (!isNew && d.order.trim() !== '') {
    const o = whole(d.order);
    if (o === null || o > limits.order_max) return `Order: a whole number from 0 to ${limits.order_max}.`;
  }
  if (!isNew && d.remind.trim() !== '') {
    const r = remindValue(d.remind);
    const { remind_min: lo, remind_max: hi, remind_step: step } = limits;
    if (r === null || r < lo || r > hi || Math.abs(r / step - Math.round(r / step)) > 1e-9) {
      return `Reminder: a number from ${lo} to ${hi} in steps of ${step}, or empty for none.`;
    }
  }
  return null;
}

export const editFields = (name: string, d: Draft): FieldValues => ({
  action: 'edit',
  name,
  label: tidy(d.label),
  target: d.target.trim(),
  ...(d.order.trim() !== '' ? { order: d.order.trim() } : {}),
  aim: d.aim,
  // always sent: empty clears the reminder (the door keeps it only when the field is left out)
  remind_after: d.remind.trim(),
});

export const newFields = (d: Draft): FieldValues => ({
  action: 'new',
  label: tidy(d.label),
  group: d.group,
  target: d.target.trim(),
  track: d.track ? '1' : '0',
});

/** Track or Untrack: `on` is what the habit becomes. */
export const trackFields = (name: string, on: boolean): FieldValues => ({ action: 'track', name, on: on ? '1' : '0' });
export const retireFields = (name: string): FieldValues => ({ action: 'retire', name });
export const restoreFields = (name: string): FieldValues => ({ action: 'restore', name });
/** Delete is asked once; its yes sends confirmed. */
export const deleteFields = (name: string): FieldValues => ({ action: 'delete', name, confirmed: '1' });

/** Where a refusal of a manage form is shown: next to the Edit form, the New form, or the habit's row. */
export function whereOf(fields: FieldValues): string {
  const name = typeof fields.name === 'string' ? fields.name : '';
  return fields.action === 'edit' ? `edit:${name}` : fields.action === 'new' ? 'new' : `row:${name}`;
}
