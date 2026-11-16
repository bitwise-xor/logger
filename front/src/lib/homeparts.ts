/**
 * Home's other four pages (deploy 100; the door's routes came with deploy 98): the door's shapes for Zones (GET /home/zones), History
 * (GET /home/history), a chore's page (GET /home/chore) and Edit zones (GET /home/edit), and what the pages make of them: a tile's
 * and a zone card's lines, the fields of each save, the drafts of the Edit forms and the checks made before a form is sent (only for
 * what the door answers with a 400, never with its own words: lines that are too many or too long, a number that is not a number).
 * The words are the door's (age_text, interval_text, label, text, per_zone.text, oldest_text, meta, how, when) wherever it gives
 * them; ages are plain text, never red. Plain TypeScript, so the tests need no browser.
 */
import { tidy } from './gym.js';
import { nWord, pairsValue, type Done, type HomeRow, type Pair } from './home.js';
import type { FieldValues } from './saver.js';

// ---- the door's shapes (docs/API.md, "Home (98)"; front/tests/samples/home.json is a real answer) ---------------------------

/** A zone tile of "Whole flat": the row of one chore in one zone, with the short age and whether it is tinted. */
export interface Tile extends HomeRow {
  age_short: string;
  tinted: boolean;
}

export interface StartJob {
  chore_id: number;
  name: string;
  pairs: Pair[];
  zone: string | null;
  zones: number;
  where: string;
  interval: number;
  interval_text: string;
}

export interface FlatChore {
  chore_id: number;
  name: string;
  interval: number;
  interval_text: string;
  minutes: number;
  all_done_today: boolean;
  per_zone: {
    text: string;
    groups: { interval: number; interval_text: string; zones: { zone_id: number; short: string }[] }[];
    off: { zone_id: number; short: string }[];
  };
  tiles: Tile[];
}

export interface ZoneCardRead {
  zone_id: number;
  name: string;
  short: string;
  count: number;
  own: number;
  chores: HomeRow[];
  open: boolean;
  todoist: boolean;
  oldest_age: number | null;
  /** "3 weeks ago" or "not yet" (null without chores); app. writes "oldest 3 weeks ago". */
  oldest_text: string | null;
}

export interface Zones {
  today: string;
  empty: boolean;
  start: { jobs: StartJob[]; more: number; answers: { ago: string; label: string }[] };
  flat: FlatChore[];
  zones: ZoneCardRead[];
}

export interface HistoryDay {
  day: string;
  label: string;
  rows: Done[];
}

export interface History {
  today: string;
  limit: number;
  step: number;
  max: number;
  more: boolean;
  count: number;
  days: HistoryDay[];
  jobs: { pairs: Pair[]; label: string }[];
  earlier_days: number;
}

export interface DoneDay {
  day: string;
  start: boolean;
}

export interface ChoreZone {
  zone_id: number;
  zone: string;
  on: boolean;
  interval: number;
  interval_text: string;
  minutes: number;
  text: string;
  usually_days: number | null;
  usually: string | null;
  last: DoneDay[];
  last_text: string;
}

export interface Chore {
  chore_id: number;
  name: string;
  zone_id: number | null;
  zone: string;
  flat: boolean;
  active: boolean;
  interval: number;
  interval_text: string;
  minutes: number;
  meta: string;
  steps: string[];
  howto: string | null;
  words: string[];
  last: DoneDay[];
  last_text: string | null;
  usually_days: number | null;
  usually: string | null;
  zones: ChoreZone[] | null;
}

export interface PerZone {
  zone_id: number;
  zone: string;
  on: boolean;
  days: number | null;
  minutes: number | null;
}

export interface EditChore {
  chore_id: number;
  name: string;
  zone_id: number | null;
  flat: boolean;
  active: boolean;
  interval: number;
  interval_text: string;
  minutes: number;
  meta: string;
  steps: string[];
  howto: string | null;
  words: string[];
  per_zone: PerZone[] | null;
}

export interface EditZone {
  zone_id: number;
  name: string;
  short: string;
  spots: string[];
  words: string[];
  active: boolean;
  count: number;
  chores: EditChore[];
}

export interface Limits {
  zone_name_max: number;
  short_max: number;
  spots_max: number;
  spot_max: number;
  chore_name_max: number;
  steps_max: number;
  step_max: number;
  howto_max: number;
  words_max: number;
  word_max: number;
  days_min: number;
  days_max: number;
  minutes_min: number;
  minutes_max: number;
  minutes_default: number;
  goal_min: number;
  goal_max: number;
}

export interface Edit {
  goal: number;
  flat: EditChore[];
  zones: EditZone[];
  zone_options: { zone_id: number | null; label: string; active: boolean }[];
  limits: Limits;
}

// ---- Zones --------------------------------------------------------------------------------------------------------------------

/** "When did you last do these?": a job's line (app.: "Dust · Kitchen" or "Mop · 3 zones", then its interval). */
export const startTitle = (j: Pick<StartJob, 'name' | 'where'>) => `${j.name} · ${j.where}`;

/** "4 more jobs after these." */
export const moreJobs = (n: number) => (n > 0 ? `${nWord(n, 'more job')} after these.` : null);

export const START_NOTE = 'A rough answer is enough: it gives the job a starting point. It is not a session and not under Recently done.';
export const FLAT_NOTE = 'Do it all, or one zone at a time. Tap a zone when it’s done.';

/** A job's key (its pairs): the chips of one row, the row that leaves at once. */
export const startKey = (j: Pick<StartJob, 'pairs'>) => pairsValue(j.pairs);

/** A starting point's fields: the job's pairs and the answer (week, month, longer, unknown). */
export const startFields = (j: Pick<StartJob, 'pairs'>, ago: string): FieldValues => ({ pairs: startKey(j), ago });

/** "All done" (a whole-flat chore): "All done ✓" once every zone is done today (a second tap takes it back). */
export const allDoneText = (f: Pick<FlatChore, 'all_done_today'>, on = f.all_done_today) => (on ? 'All done ✓' : 'All done');
export const ALL_DONE_TITLE = 'Done in every zone today. Tap again to take it back.';
export const alldoneFields = (f: Pick<FlatChore, 'chore_id'>): FieldValues => ({ chore_id: String(f.chore_id) });

/** A tile's hover title and its screen reader words (app.'s _tile). */
export const tileTitle = (t: Pick<Tile, 'zone' | 'interval_text'>) => `${t.zone}: ${t.interval_text}`;
export const tileLabel = (t: Pick<Tile, 'name' | 'zone' | 'age_text'>) => `${t.name} ${t.zone}: ${t.age_text}. Tap when it is done.`;

/** A row of a zone card (app.'s _row with zone_first): "weekly · 3 days ago", the interval first (Now writes the age first). */
export const zoneRowMeta = (r: Pick<HomeRow, 'age_text' | 'interval_text'>) => `${r.interval_text} · ${r.age_text}`;

/** A zone card's summary: "4 chores · oldest 3 weeks ago" (or "oldest not yet"). */
export const zoneSummary = (z: Pick<ZoneCardRead, 'count' | 'oldest_text'>) => `${nWord(z.count, 'chore')} · oldest ${z.oldest_text ?? 'not yet'}`;

export const NO_CHORES = 'no recurring chores';
export const TODOIST = 'sorting jobs in Todoist ›';
/** The one link that still leaves for app.: the Storage zone's sorting jobs. */
export const todoistHref = (appUrl: string) => `${appUrl}/web/ideas/todoist`;

/** The tiles' pairs, by key: a tick on a tile and on the same pair's row in a zone card are one tap. */
export const tickKey = (r: Pick<HomeRow, 'chore_id' | 'zone_id'>) => `${r.chore_id}:${r.zone_id}`;

// ---- History ------------------------------------------------------------------------------------------------------------------

export const historyHref = (n?: number | null) => (n && n > 0 ? `/home/history?n=${n}` : '/home/history');
/** "Show more": the next page of the door's rows (?n=limit + step), while there is more. */
export const moreHref = (h: Pick<History, 'more' | 'limit' | 'step'>) => (h.more ? historyHref(h.limit + h.step) : null);
export const lastLine = (h: Pick<History, 'count'>) => `last ${h.count}`;
/** A row's time: blank for a dated one (a job done earlier, a starting point). */
export const timeOf = (e: Pick<Done, 'dated' | 'time'>) => (e.dated ? '' : (e.time ?? ''));
export const removeFields = (e: Pick<Done, 'ids'>): FieldValues => ({ ids: e.ids.join(',') });
export const removeLabel = (e: Pick<Done, 'label'>) => `Remove ${e.label}`;
/** The key of a history row (its ids, as the door gives them). */
export const doneKey = (e: Pick<Done, 'ids'>) => e.ids.join(',');
export const EARLIER_NOTE = 'It gets 12:00 on that day.';
/** "+ Add one done earlier": the chosen job's pairs ("3-1", the option's value) and the date. */
export const earlierFields = (pairs: string, date: string): FieldValues => ({ pairs, when: date });
/** A job's option value in the select ("3-1"). */
export const jobValue = (j: { pairs: Pair[] }) => pairsValue(j.pairs);

// ---- a chore's page -----------------------------------------------------------------------------------------------------------

export const CHORE_GONE = 'That chore is not in the list.';
/** A chore's id from the address: digits only, else none (the door then says it is not in the list). */
export const choreIdOf = (v: string | null) => (v && /^\d{1,9}$/.test(v) ? v : '');
export const editHref = (choreId: number) => `/home/edit#chore-${choreId}`;
/** `#chore-12` of the address: the chore whose form Edit opens. */
export const choreOfHash = (hash: string): number | null => {
  const m = /^#chore-(\d{1,9})$/.exec(hash);
  return m ? Number(m[1]) : null;
};

/** A zone of a whole-flat chore: its words, and its dates. */
export function zoneLine(z: ChoreZone) {
  return { name: z.zone, extra: [z.text, z.usually].filter(Boolean).join(' · '), dates: z.last_text };
}

// ---- Edit zones ---------------------------------------------------------------------------------------------------------------

export const GOAL_NOTE = 'A session is a day with a job done or a timer run out.';
export const FLAT_EDIT_NOTE = 'each zone is tracked on its own';
export const HISTORY_STAYS = 'History stays.';
export const RETIRE_CHORE = 'Retire';
export const BRING_BACK = 'Bring back';
export const choreToggle = (c: Pick<EditChore, 'active'>) => (c.active ? RETIRE_CHORE : BRING_BACK);
export const zoneToggle = (z: Pick<EditZone, 'active'>) => (z.active ? 'Retire this zone' : BRING_BACK);
export const zoneTitle = (z: Pick<EditZone, 'name' | 'active'>) => (z.active ? z.name : `${z.name} · retired`);
export const PER_ZONE_NOTE = (c: Pick<EditChore, 'interval_text' | 'minutes'>) => `Blank = the chore’s (${c.interval_text}, ${c.minutes} min). Untick a zone where it is not done.`;

/** The zones the "Where" select offers: Whole flat, every active zone, and a retired one only for the chore already in it. */
export function whereOptions(edit: Pick<Edit, 'zone_options'>, current: string) {
  return edit.zone_options.filter((o) => o.active || valueOfZone(o.zone_id) === current).map((o) => ({ value: valueOfZone(o.zone_id), label: o.label }));
}
/** A zone's value in the form: "flat" for the whole flat. */
export const valueOfZone = (id: number | null) => (id === null ? 'flat' : String(id));

/** The form keys: which form a draft, an open state and a refusal belong to. */
export const keyOf = {
  chore: (id: number) => `c:${id}`,
  perZone: (id: number) => `pz:${id}`,
  zone: (id: number) => `z:${id}`,
  newChore: 'newchore',
  newZone: 'newzone',
  goal: 'goal',
} as const;

export interface ChoreDraft {
  name: string;
  zone: string;
  days: string;
  minutes: string;
  steps: string;
  howto: string;
  words: string;
}

export const choreDraftOf = (c: EditChore): ChoreDraft => ({
  name: c.name,
  zone: valueOfZone(c.zone_id),
  days: String(c.interval),
  minutes: String(c.minutes),
  steps: c.steps.join('\n'),
  howto: c.howto ?? '',
  words: c.words.join(', '),
});
export const newChoreDraft = (limits: Pick<Limits, 'minutes_default'>): ChoreDraft => ({
  name: '',
  zone: 'flat',
  days: '',
  minutes: String(limits.minutes_default),
  steps: '',
  howto: '',
  words: '',
});

export interface ZoneDraft {
  name: string;
  short: string;
  spots: string;
  words: string;
}
export const zoneDraftOf = (z: EditZone): ZoneDraft => ({ name: z.name, short: z.short, spots: z.spots.join('\n'), words: z.words.join(', ') });
export const newZoneDraft = (): ZoneDraft => ({ name: '', short: '', spots: '', words: '' });

/** One text of a list a line each (steps, spots): tidied, the blank lines dropped. */
export const linesOf = (s: string): string[] => s.split(/\r?\n/).map(tidy).filter(Boolean);
/** The words of a list typed with commas. */
export const wordsOfText = (s: string): string[] => s.split(',').map(tidy).filter(Boolean);

const WHOLE = /^\d{1,9}$/;

/** What the door answers with a plain 400 and not with a refusal of its own, said here in its place: lines and words too many or too long. */
function listProblem(items: string[], most: number, width: number, what: string, perLine: boolean): string | null {
  if (items.length > most) return `${what}: at most ${most}${perLine ? ', one per line' : ', separated by commas'}.`;
  if (items.some((x) => x.length > width)) return `${what}: each at most ${width} characters.`;
  return null;
}

/** The checks before a chore form is sent. The door's own refusals (the ranges, the zone) are left to it. */
export function choreProblem(d: ChoreDraft, limits: Limits): string | null {
  if (tidy(d.name).length > limits.chore_name_max) return `The name is at most ${limits.chore_name_max} characters.`;
  if (!WHOLE.test(d.days.trim()) || (d.minutes.trim() !== '' && !WHOLE.test(d.minutes.trim()))) {
    return 'Give the interval in whole days and the minutes as a whole number.';
  }
  if (tidy(d.howto).length > limits.howto_max) return `The how-to line is at most ${limits.howto_max} characters.`;
  return (
    listProblem(linesOf(d.steps), limits.steps_max, limits.step_max, 'Steps', true) ??
    listProblem(wordsOfText(d.words), limits.words_max, limits.word_max, 'Other words', false)
  );
}

export function zoneProblem(d: ZoneDraft, limits: Limits): string | null {
  if (tidy(d.name).length > limits.zone_name_max) return `The name is at most ${limits.zone_name_max} characters.`;
  if (tidy(d.short).length > limits.short_max) return `The tile label is at most ${limits.short_max} characters.`;
  return (
    listProblem(linesOf(d.spots), limits.spots_max, limits.spot_max, 'Spots', true) ??
    listProblem(wordsOfText(d.words), limits.words_max, limits.word_max, 'Other words', false)
  );
}

/** A chore form's fields (docs/API.md `chorenew`, `choreedit`): the id only on an edit; "flat" is the whole flat. */
export const choreFields = (d: ChoreDraft, id?: number): FieldValues => ({
  ...(id === undefined ? {} : { chore_id: String(id) }),
  name: d.name,
  zone_id: d.zone,
  days: d.days.trim(),
  minutes: d.minutes.trim(),
  steps: d.steps,
  howto: d.howto,
  words: d.words,
});

export const zoneFields = (d: ZoneDraft, id?: number): FieldValues => ({
  ...(id === undefined ? {} : { zone_id: String(id) }),
  name: d.name,
  short: d.short,
  spots: d.spots,
  words: d.words,
});

/** Retire (on 0) or Bring back (on 1). */
export const activeFields = (idName: 'chore_id' | 'zone_id', id: number, on: boolean): FieldValues => ({ [idName]: String(id), on: on ? '1' : '0' });

export const goalFields = (goal: string): FieldValues => ({ goal: goal.trim() });
/** The weekly goal typed: whole sessions; the range (1 to 7) is the door's to refuse. */
export const goalProblem = (v: string, limits: Pick<Limits, 'goal_min' | 'goal_max'>): string | null =>
  WHOLE.test(v.trim()) ? null : `The weekly goal is ${limits.goal_min} to ${limits.goal_max} sessions.`;

/** One row of the Per zone table as typed. */
export interface PerZoneDraft {
  zone_id: number;
  zone: string;
  on: boolean;
  days: string;
  minutes: string;
}
export const perZoneDraftOf = (c: EditChore): PerZoneDraft[] =>
  (c.per_zone ?? []).map((z) => ({ zone_id: z.zone_id, zone: z.zone, on: z.on, days: z.days === null ? '' : String(z.days), minutes: z.minutes === null ? '' : String(z.minutes) }));

export const PER_ZONE_PROBLEM = 'Give the days (1 to 730) and minutes (1 to 240) as whole numbers, or leave them blank.';
export function perZoneProblem(rows: PerZoneDraft[]): string | null {
  return rows.some((r) => (r.days.trim() !== '' && !WHOLE.test(r.days.trim())) || (r.minutes.trim() !== '' && !WHOLE.test(r.minutes.trim()))) ? PER_ZONE_PROBLEM : null;
}

/** The Per zone table's fields: every zone listed, a zone left unticked is off (the door: a zone left out is off), blank = the chore's own. */
export function perZoneFields(c: Pick<EditChore, 'chore_id'>, rows: PerZoneDraft[]): FieldValues {
  const f: FieldValues = { chore_id: String(c.chore_id), zone_ids: rows.map((r) => String(r.zone_id)) };
  for (const r of rows) {
    if (r.on) f[`on_${r.zone_id}`] = '1';
    f[`days_${r.zone_id}`] = r.days.trim();
    f[`min_${r.zone_id}`] = r.minutes.trim();
  }
  return f;
}

/** Which form a save belongs to (its refusal is said next to it, its draft closes on success). */
export function formOf(action: string, fields: FieldValues): string | null {
  const id = (k: string) => Number(fields[k]);
  switch (action) {
    case 'home_choreedit':
      return keyOf.chore(id('chore_id'));
    case 'home_chorenew':
      return keyOf.newChore;
    case 'home_chorezones':
      return keyOf.perZone(id('chore_id'));
    case 'home_zoneedit':
      return keyOf.zone(id('zone_id'));
    case 'home_zonenew':
      return keyOf.newZone;
    case 'home_goalset':
      return keyOf.goal;
    default:
      return null;
  }
}
