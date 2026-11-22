/**
 * Every page's saves (Today's since step C, deploy 80, and every page's since): what each form action sends to the door (docs/API.md,
 * "Saves"). How each save behaves (its route, its key, whether it is sent again, its waits, its pages) is the table in
 * src/lib/saverules.ts (web item 72); this file adds the bodies, the checks and a read first under the same names, and makes the
 * page lists (`TODAY_SAVES`, …) from the table.
 *
 * Every tap on Today is a SvelteKit form action (src/routes/(app)/+page.server.ts). The browser sends the form's fields and a
 * new `key` per tap (the same key again when it re-sends that tap after a sign-in, src/lib/saver.ts); this file turns the fields
 * into the door's JSON body, adds the key where the door's route takes one, and asks for the fresh day in the answer
 * (`view: "day"`, `view: "food"` with the day shown for the Food day, or `view: "usual"`), so the page can replace what it shows
 * without a reload.
 *
 * Plain TypeScript with no SvelteKit import, so the tests can hand it a door with a fake network.
 */
import type { Door } from './door.js';
import { DoorError } from './door.js';
import { problemOf, problemText, replays, unsureText, type ProblemKind } from '../problems.js';
import { labeladdBody } from '../scan.js';
import { bodyValues, healthValues } from '../health.js';
import { SHOWS } from '../habits.js';
import { VALS, wordsOf } from '../gym.js';
import { linesOf, wordsOfText } from '../homeparts.js';
import { CATALOGUE_FILTERS, CATALOGUE_SORTS } from '../catalogue.js';
import { askedOpen, askedTest } from '../medical.js';
import { FILTERS } from '../coach.js';
import { measureBody, nudgesBody, type Nudge } from '../settings.js';
import { subscriptionProblem } from '../pushdevice.js';
import { LONG_TIMEOUT_MS, SAVE_NAMES, SAVE_RULES, savesOn, type SaveName, type SavePage, type SaveRule } from '../saverules.js';

/** The form's fields: what `FormData` offers (and a plain test double). */
export interface Fields {
  get(name: string): FormDataEntryValue | null;
  getAll(name: string): FormDataEntryValue[];
}

type Body = Record<string, unknown>;

/** What the form action knows besides the form (deploy 112): the browser's User-Agent header, for /push/subscribe's device name. */
export interface Asked {
  userAgent?: string | null;
  /** The nudges the door lists (Web 70: GET /settings/notify, read by runSave just before POST /settings/nudges). */
  nudges?: Nudge[];
}

/** What goes to the door for a save (its route, key and waits are the table's: src/lib/saverules.ts). */
interface Build {
  body: (f: Fields, asked: Asked) => Body;
  /** Why the form cannot go to the door (checked first; the door is not asked): "Not saved." with these words. */
  check?: (f: Fields, asked: Asked) => string | null;
  /** A read of the door the save needs first (Web 70: the nudges the door lists), added to what the action knows. */
  before?: (door: Door, session: string) => Promise<Partial<Asked>>;
}

/** A save as runSave uses it: the table's route, whether a key goes with it, the server's wait (none: the door client's 15 s). */
type Save = Build & {
  path: string;
  /** A key goes with it (the table's `key` is not `none`): a re-sent tap then saves once where the core replays it. */
  keyed: boolean;
  timeoutMs?: number;
};

const str = (f: Fields, name: string, limit = 200): string | undefined => {
  const v = f.get(name);
  if (typeof v !== 'string') return undefined;
  const t = v.trim().slice(0, limit);
  return t === '' ? undefined : t;
};

/** A whole number, or left out (the door then says what is missing or wrong). */
const int = (f: Fields, name: string): number | undefined => {
  const t = str(f, name, 20);
  return t !== undefined && /^\d{1,12}$/.test(t) ? Number(t) : undefined;
};

/** An amount as a number ("60", "12.5"); anything else is sent as it is, and the door refuses it in plain words. */
const amount = (v: FormDataEntryValue): number | string => {
  const t = typeof v === 'string' ? v.trim().slice(0, 20) : '';
  return /^\d{1,6}(\.\d{1,3})?$/.test(t) ? Number(t) : t;
};

/** A usual meal's foods (deploy 87): the form's food_id and amount fields, pair by pair, in their order (at most 40, as the door). */
function items(f: Fields): { food_id: number | string; amount: number | string }[] {
  const ids = f.getAll('food_id').slice(0, 40);
  const amounts = f.getAll('amount');
  return ids.map((id, k) => {
    const t = typeof id === 'string' ? id.trim() : '';
    return { food_id: /^\d{1,12}$/.test(t) ? Number(t) : t, amount: amount(amounts[k] ?? '') };
  });
}

/** A usual meal's box on Today (deploy 117): the ticked foods' item_id and amount fields, pair by pair, in their order. */
function usualItems(f: Fields): { item_id: number | string; amount: number | string }[] {
  const amounts = f.getAll('amount');
  return f
    .getAll('item_id')
    .slice(0, 40)
    .map((id, k) => {
      const t = typeof id === 'string' ? id.trim() : '';
      return { item_id: /^\d{1,12}$/.test(t) ? Number(t) : t, amount: amount(amounts[k] ?? '') };
    });
}

const BODIES = {
  // A typed line, as many lines as the box holds (each can be its own entry); 4000 characters as app.'s box (webentry.MAX_TEXT).
  log: { body: (f) => ({ text: str(f, 'text', 4000) }) },
  water: { body: (f) => ({ ml: int(f, 'ml') }) },
  // an Again chip; the scan sheet's "Log" (deploy 90) also sends the time (hh:mm)
  again: {
    body: (f) => ({ food_id: str(f, 'food_id', 12), amount: str(f, 'amount', 20), time: str(f, 'time', 5) }),
  },
  // a usual meal's chip: as saved; since deploy 117 its box sends only the ticked foods with their amounts (item_id and amount
  // pairs, as usual_meal reads its foods) and a time (hh:mm; none = now). The saved meal itself stays as it is.
  usual: {
    body: (f) => {
      const body: Body = { meal_id: str(f, 'meal_id', 12), time: str(f, 'time', 5) };
      if (f.getAll('item_id').length) body.items = usualItems(f);
      return body;
    },
    check: (f) => {
      const ids = f.getAll('item_id');
      if (!ids.length) return null;
      if (ids.length !== f.getAll('amount').length) return 'Give every food you tick an amount.';
      if (ids.length > 40) return 'At most 40 foods.';
      return usualItems(f).every((i) => typeof i.item_id === 'number' && typeof i.amount === 'number' && i.amount > 0)
        ? null
        : 'Give every food you tick an amount above 0.';
    },
  },
  habit: {
    body: (f) => ({ name: str(f, 'name', 64), action: str(f, 'action', 10), ref: str(f, 'ref', 20) }),
  },
  checkin: {
    body: (f) => ({ type: str(f, 'type', 10), value: str(f, 'value', 3), day: str(f, 'day', 10) }),
  },
  health: {
    body: (f) => ({
      row: str(f, 'row', 20),
      ref: str(f, 'ref', 20),
      v1: str(f, 'v1', 20),
      v2: str(f, 'v2', 20),
      time: str(f, 'time', 5),
      confirmed: f.get('confirmed') === '1' ? true : undefined,
    }),
  },
  answer: { body: (f) => ({ question_id: str(f, 'question_id', 64), reply: str(f, 'reply', 2000) }) },
  review: {
    body: (f) =>
      str(f, 'action', 5) === 'all'
        ? { action: 'all', refs: f.getAll('refs').filter((r): r is string => typeof r === 'string').slice(0, 200) }
        : { action: str(f, 'action', 5), ref: str(f, 'ref', 20) },
  },
  held_retry: { body: (f) => ({ id: int(f, 'id') }) },
  held_delete: { body: (f) => ({ id: int(f, 'id') }) },
  undo: { body: (f) => ({ token: str(f, 'token', 200) }) },
  // The Food day (step E): change a row (amount in a unit, time hh:mm, another food by its name) or delete it; an odd value is
  // read back first (then the same with confirmed). The door's routes take no key: a change made twice is caught as on app.
  food_entry: {
    body: (f) => ({
      ref: str(f, 'ref', 12),
      action: str(f, 'action', 10),
      amount: str(f, 'amount', 20),
      unit: str(f, 'unit', 40),
      time: str(f, 'time', 5),
      food_name: str(f, 'food_name', 200),
      confirmed: f.get('confirmed') === '1' ? true : undefined,
    }),
  },
  // A row's note; empty removes it (300 characters, as app.).
  food_note: { body: (f) => ({ ref: str(f, 'ref', 12), note: str(f, 'note', 300) ?? '' }) },
  // A meal's one-line note (21.11.2026): day, meal (0: the day's note when no meal is left), note (empty = removed). No key, no Undo.
  food_mealnote: { body: (f) => ({ day: str(f, 'day', 10), meal: int(f, 'meal'), note: str(f, 'note', 300) ?? '' }) },
  // The Usual meals page (deploy 87): one Save changes a meal (its name and the whole list of foods, in order) or deletes it;
  // made at once with Undo, so the front end always sends confirmed (the door would read it back first otherwise).
  usual_meal: {
    body: (f) => {
      const action = str(f, 'action', 10);
      const base = { meal_id: int(f, 'meal_id'), action, confirmed: true };
      return action === 'save' ? { ...base, name: str(f, 'name', 200) ?? '', items: items(f) } : base;
    },
  },
  // A new usual meal or drink from foods (1 to 8, as app.).
  usual_new: {
    body: (f) => ({ name: str(f, 'name', 200) ?? '', drink: f.get('drink') === '1', items: items(f) }),
  },
  // "Save as usual meal" on a meal of the Food day (not the drinks, meal 0): the day, the meal's number and a name.
  usual_from_meal: {
    body: (f) => ({ day: str(f, 'day', 10), meal: int(f, 'meal'), name: str(f, 'name', 200) ?? '' }),
  },
  // The scan sheet (deploy 90): the checked values of a label photo or of Open Food Facts as a new food, logged at once with an
  // amount (Undo takes back the entry only); a key saves once (src/lib/scan.ts makes the body).
  labeladd: { body: (f) => labeladdBody(f) },
  // "Look it up" on a food question under Needs you: the words typed in its field, or none (the door then looks up the question's
  // word); the food found is read back as a question (Yes through /answer). An AI call picks the best fit: up to 60 s.
  lookup: {
    body: (f) => ({ text: str(f, 'text', 200), question_id: str(f, 'question_id', 64) }),
  },
  // The Health page (deploy 92): one day's row (only the rows changed: `values`), a body session (only the measures changed). A
  // value cleared is read back first (Yes = confirm_delete), then an odd value (Yes = confirmed, keeping confirm_delete).
  health_day: {
    body: (f) => ({ day: str(f, 'day', 10), values: healthValues(f), ...yes(f) }),
  },
  body: { body: (f) => ({ day: str(f, 'day', 10), values: bodyValues(f), ...yes(f) }) },
  // The Habits page (deploy 94): a square of the calendar (a day with fewer ticks than the habit's times a day gets one, a done day
  // has its ticks taken off) and the list's forms. The key is new per tap but the day tap is never sent again by the page: the
  // door does not replay it (a re-sent key would untick, docs/API.md). The list's forms have no Undo.
  habit_day: { body: (f) => ({ name: str(f, 'name', 64), day: str(f, 'day', 10) }) },
  habits_manage: { body: (f) => manageBody(f) },
  // Today's "Not today" on "Body measurements due": hidden until the next health day (no key, no Undo).
  body_skip: { body: () => ({}) },
  // The Gym's Workout page (deploy 96): the door's /gym/<action> takes numbers as JSON numbers and ids as numbers. Only the tick
  // takes a key (app.'s rule); the page never sends a gym save again by itself (saverules.ts). Each answers with the
  // Workout read (view "gym").
  gym_tick: {
    body: (f) => ({ exercise_id: int(f, 'exercise_id'), ...Object.fromEntries(VALS.map((k) => [k, gymNumber(f, k)])) }),
  },
  // one logged row (set_id), or all of today's rows of an exercise (a done circle: exercise_id); the door wants one of them
  gym_remove: {
    body: (f) => (str(f, 'set_id', 12) !== undefined ? { set_id: int(f, 'set_id') } : { exercise_id: int(f, 'exercise_id') }),
  },
  // a day of the split, or Free workout (day_id null: the field empty)
  gym_pick: { body: (f) => ({ day_id: str(f, 'day_id', 12) === undefined ? null : int(f, 'day_id') }) },
  // + Add exercise on the Workout page: today true puts it on today's day of the split; other words typed with commas
  gym_new: {
    body: (f) => ({ name: str(f, 'name', 60) ?? '', kind: str(f, 'kind', 20), words: wordsOf(str(f, 'words', 600) ?? ''), today: f.get('today') === '1' ? true : undefined }),
  },
  // The Plan part (deploy 97): a day's exercises and the days of the split. None takes a key, none has Undo but itemremove. Each
  // answers with the Plan read (view "gym_plan"). Ids are numbers; sets and reps as JSON numbers, both null for no plan numbers.
  gym_itemset: {
    body: (f) => ({ item_id: int(f, 'item_id'), sets: gymNumber(f, 'sets'), reps: gymNumber(f, 'reps') }),
  },
  gym_itemmove: { body: (f) => ({ item_id: int(f, 'item_id'), dir: str(f, 'dir', 4) }) },
  gym_itemremove: { body: (f) => ({ item_id: int(f, 'item_id') }) },
  // sets and reps both or neither: the door says so
  gym_itemadd: {
    body: (f) => ({ day_id: int(f, 'day_id'), exercise_id: int(f, 'exercise_id'), sets: gymNumber(f, 'sets'), reps: gymNumber(f, 'reps') }),
  },
  gym_daynew: { body: (f) => ({ name: str(f, 'name', 40) ?? '' }) },
  gym_dayedit: { body: (f) => ({ day_id: int(f, 'day_id'), name: str(f, 'name', 40) ?? '' }) },
  // Remove a day (on 0) or bring it back (on 1): the door wants true or false
  gym_dayactive: { body: (f) => ({ day_id: int(f, 'day_id'), on: f.get('on') === '1' }) },
  // The Exercises part (deploy 97): Rename, Retire or Bring back (+ New exercise is gym_new without today). Each answers with the
  // Exercises read (view "gym_exercises"); no key, no Undo.
  gym_rename: { body: (f) => ({ exercise_id: int(f, 'exercise_id'), name: str(f, 'name', 60) ?? '' }) },
  gym_active: { body: (f) => ({ exercise_id: int(f, 'exercise_id'), on: f.get('on') === '1' }) },
  // Home's Now and Pick pages (deploy 99): the door's /home/<action> takes ids as numbers and pairs as [[chore_id, zone_id], ...].
  // Only tick, pickdone, picknext and earlier take a key (home._once); the page never sends a Home save again by itself (saver.ts).
  // A tick toggles: a pair done today is ticked off again. Each answers with its page's read (view "home" or "home_pick").
  home_tick: { body: (f) => ({ chore_id: int(f, 'chore_id'), zone_id: int(f, 'zone_id') }) },
  // the Pick page's timer: start (the job's pairs and the page's minutes), pause, resume, stop (its id)
  home_start: { body: (f) => ({ pairs: pairsOf(f), minutes: int(f, 'minutes') }) },
  home_pause: { body: (f) => ({ timer_id: int(f, 'timer_id') }) },
  home_resume: { body: (f) => ({ timer_id: int(f, 'timer_id') }) },
  home_stop: { body: (f) => ({ timer_id: int(f, 'timer_id') }) },
  // "Done" (the timer's id may come along), "Done, next job" (running only), "Not today", "Done it earlier?" (1 to 7 days ago, or a date)
  home_pickdone: { body: (f) => ({ pairs: pairsOf(f), timer_id: int(f, 'timer_id') }) },
  home_picknext: { body: (f) => ({ pairs: pairsOf(f), timer_id: int(f, 'timer_id') }) },
  home_skip: { body: (f) => ({ pairs: pairsOf(f) }) },
  home_earlier: { body: (f) => ({ pairs: pairsOf(f), when: whenOf(f) }) },
  // Home's other four pages (deploy 100). Zones: "All done" on a whole-flat chore and a starting point's chips (both keyed, both with
  // Undo; the tile and the row's tick are home_tick). History: the × on a row (no key; its ids as numbers, Undo puts them back) and
  // "+ Add one done earlier" (home_earlier). Edit zones: the weekly goal, the zone and chore forms, Retire and Bring back and the Per
  // zone table: none takes a key, none has Undo. Each answers with its page's read (view "home_zones", "home_history", "home_edit").
  home_alldone: { body: (f) => ({ chore_id: int(f, 'chore_id') }) },
  home_startpoint: { body: (f) => ({ pairs: pairsOf(f), ago: str(f, 'ago', 10) }) },
  home_remove: { body: (f) => ({ ids: idsOf(f) }) },
  home_goalset: { body: (f) => ({ goal: int(f, 'goal') }) },
  home_zonenew: { body: (f) => zoneBody(f) },
  home_zoneedit: { body: (f) => ({ zone_id: int(f, 'zone_id'), ...zoneBody(f) }) },
  home_zoneactive: { body: (f) => ({ zone_id: int(f, 'zone_id'), on: f.get('on') === '1' }) },
  home_chorenew: { body: (f) => choreBody(f) },
  home_choreedit: { body: (f) => ({ chore_id: int(f, 'chore_id'), ...choreBody(f) }) },
  home_choreactive: { body: (f) => ({ chore_id: int(f, 'chore_id'), on: f.get('on') === '1' }) },
  home_chorezones: { body: (f) => ({ chore_id: int(f, 'chore_id'), zones: zonesOf(f) }) },
  // The Week review's button (deploy 102, the Trends page): POST /coach/start with the card's period. The door takes NO key and the
  // page never sends it again by itself (saver.ts: not keyed, never kept; a review costs about 20 cents). kind is always "week" (the
  // door has no day coaching yet). It answers with the coaching and the fresh Week of the page's period (view "week", view_p). The
  // core only starts the AI in the background, but the door is given 60 s, so a slow answer is not mistaken for "not saved".
  coach_start: {
    body: (f) => ({ kind: 'week', start: dateOf(f, 'start'), end: dateOf(f, 'end') }),
  },
  // The Coach card's button (deploy 109, Today and the Coach page): POST /coach/start with kind "day", the day twice. The door takes NO
  // key and the page never sends it again by itself (saver.ts: not keyed, never kept; a day coaching costs about 6 cents). Today's
  // answer brings the fresh Today (view "day", view_day), the Coach page's the fresh Coach page (view "coach", view_f, view_day).
  // The Week review's own (`coach_start`, Trends) stays as it is.
  coach_day: {
    body: (f) => {
      const day = dateOf(f, 'start');
      return { kind: 'day', start: day, end: day };
    },
  },
  // Library's Foods tab (deploy 105): the Catalogue's six forms at /food/catalogue/<action> (docs/API.md). The door takes NO key and
  // has no Undo; the page never sends one again by itself (saverules.ts). Ids and values as JSON numbers, ticks as true or
  // false. Each answers with the fresh Catalogue and the open food's box (view "catalogue" with view_q, view_f, view_s, view_food).
  // values: only the values the owner changed (one left out stays as it is); shown first, then the same with confirmed.
  catalogue_values: {
    body: (f) => ({
      id: int(f, 'id'),
      ...Object.fromEntries(CATALOGUE_VALUES.filter((k) => str(f, k, 20) !== undefined).map((k) => [k, foodNumber(f, k)])),
      past: f.get('past') === '1',
      confirmed: f.get('confirmed') === '1' ? true : undefined,
    }),
  },
  catalogue_words: { body: (f) => ({ id: int(f, 'id'), act: str(f, 'act', 10), word: str(f, 'word', 60) ?? '' }) },
  catalogue_barcode: { body: (f) => ({ id: int(f, 'id'), barcode: str(f, 'barcode', 40) ?? '' }) },
  // name, drink, hide: the form comes filled in, so all three are sent (the door keeps one left out as it is)
  catalogue_basics: {
    body: (f) => ({ id: int(f, 'id'), name: str(f, 'name', 120) ?? '', drink: f.get('drink') === '1', hide: f.get('hide') === '1' }),
  },
  // a unit and its weight (grams, or ml for a drink); empty grams is null (the door then asks for it)
  catalogue_unit: {
    body: (f) => ({ id: int(f, 'id'), unit: str(f, 'unit', 30) ?? '', grams: str(f, 'grams', 20) === undefined ? null : foodNumber(f, 'grams') }),
  },
  catalogue_reviewed: { body: (f) => ({ id: int(f, 'id') }) },
  // Medical's three forms (deploy 106, docs/API.md "Medical's saves"): a correction of a lab value, of a report's date, title, lab and notes,
  // and of a medication course (or its End). The door takes NO key and has no Undo; the page never sends one again by itself
  // (saverules.ts; not after a sign-in either). Each is shown first (needs_confirmation, its read-back in the answer bar), then the same with
  // confirmed. Only the fields typed over are sent (one left out stays as it is); a cleared one goes as null (empty). The answer brings
  // the fresh read (view "labs" with view_open, "labs_meds").
  labs_value: {
    body: (f) => ({ id: int(f, 'id'), value: typed(f, 'value', 60), unit: typed(f, 'unit', 30), ref: typed(f, 'ref', 60), confirmed: confirmedOf(f) }),
  },
  labs_report: {
    body: (f) => ({
      id: int(f, 'id'),
      collected: typedDate(f, 'collected'),
      title: typed(f, 'title', 200),
      provider: typed(f, 'provider', 200),
      notes: typed(f, 'notes', 2000),
      confirmed: confirmedOf(f),
    }),
  },
  // act "save" (dose, how often, why, start, stop: empty stop = running) or "end" (a running course ends today)
  labs_med: {
    body: (f) => {
      const act = f.get('act') === 'end' ? 'end' : 'save';
      return {
        id: int(f, 'id'),
        act,
        ...(act === 'save'
          ? {
              dose: typed(f, 'dose', 60),
              frequency: typed(f, 'frequency', 60),
              indication: typed(f, 'indication', 120),
              start: typedDate(f, 'start'),
              stop: typedDate(f, 'stop'),
            }
          : {}),
        confirmed: confirmedOf(f),
      };
    },
  },
  // Settings (deploy 111; the door's routes came with 110), each through app.'s own function with its checks and words: no key (the
  // door ignores one), no Undo (a change ends the session's Undo bar, as app.'s forms do), never sent again by the page (saver.ts).
  // The nine targets: a field left empty is "no target" (null), as app.'s form; the row is all nine.
  settings_targets: { body: (f) => targetsBody(f) },
  // One tap on the Today page tab: its whole group, in the order wanted (the form's id and shown fields, pair by pair).
  settings_today: { body: (f) => todayBody(f) },
  settings_today_reset: { body: () => ({}) },
  settings_height: { body: (f) => ({ valid_from: dateOf(f, 'valid_from'), height: decimalOf(f, 'height') }) },
  // the measures shown always go (none ticked is app.'s "Keep at least one measure.")
  settings_body: {
    body: (f) => ({ interval: decimalOf(f, 'interval'), show: f.getAll('show').filter((x): x is string => typeof x === 'string').slice(0, 50) }),
  },
  // Web item 58: a body measure added, changed, moved one place or removed (the door's checks and words; no key, no Undo)
  settings_body_measure: { body: (f) => measureBody(fieldOf(f)) },
  settings_coach: { body: (f) => coachBody(f) },
  settings_device: { body: (f) => ({ id: str(f, 'id', 64) }) },
  settings_others: { body: () => ({}) },
  // Web 70: the keys and the hours' ranges are those of the door's list (GET /settings/notify, read first), never written here.
  settings_nudges: {
    before: async (door, session) => ({ nudges: (await door.get<{ settings_notify: { nudges: Nudge[] } }>('/settings/notify', session)).body.settings_notify.nudges ?? [] }),
    check: (f, asked) => nudgesBody(fieldOf(f), asked.nudges ?? []).problem,
    body: (f, asked) => nudgesBody(fieldOf(f), asked.nudges ?? []).body,
  },
  // the notifications of a device (here or at app.) off; a test to every device
  push_off: { body: (f) => ({ id: int(f, 'id') }) },
  push_test: { body: () => ({}) },
  // Notifications on this device (deploy 112): the browser's subscription from "This device" (src/lib/pushdevice.ts), checked here
  // first (an https address of up to 1000 characters, the two keys base64url of up to 200 and 100); the device's name comes from the
  // browser's User-Agent header, which the page does not send itself. The door checks the push service and the keys as app. does.
  push_subscribe: {
    check: (f) => subscriptionProblem({ endpoint: f.get('endpoint'), p256dh: f.get('p256dh'), auth: f.get('auth') }),
    body: (f, asked) => ({
      endpoint: f.get('endpoint'),
      keys: { p256dh: f.get('p256dh'), auth: f.get('auth') },
      user_agent: (asked.userAgent ?? '').slice(0, 300) || undefined,
    }),
  },
} satisfies Record<SaveName, Build>;

/** A number of a Settings form as the door takes it (a comma too); empty is left out; anything else as typed (the page checks first). */
function decimalOf(f: Fields, name: string): number | string | undefined {
  const t = str(f, name, 20);
  if (t === undefined) return undefined;
  return /^-?\d{1,9}([.,]\d{1,6})?$/.test(t) ? Number(t.replace(',', '.')) : t;
}

/** Food targets (docs/API.md /settings/targets): the date, the nine numbers (empty: null, no target) and the note (left out when empty). */
function targetsBody(f: Fields): Body {
  const body: Body = { valid_from: dateOf(f, 'valid_from'), note: str(f, 'note', 200) };
  for (const k of TARGET_KEYS) body[k] = decimalOf(f, k) ?? null;
  return body;
}

/** The nine targets, as the door names them. */
export const TARGET_KEYS = ['kcal', 'protein', 'fat', 'sat_fat', 'carbs', 'fibre', 'sugar_added', 'sodium_mg', 'water_ml'] as const;
const TODAY_KINDS = ['habit', 'health', 'usual', 'review', 'card'];

/** The Today page tab's group: {groups: {<kind>: [{id, shown}]}}, the ids in the order sent; an unknown kind sends no group. */
function todayBody(f: Fields): Body {
  const kind = str(f, 'group', 10);
  const ids = f.getAll('id').slice(0, 200);
  const shown = f.getAll('shown');
  const items = ids.filter((id): id is string => typeof id === 'string').map((id, k) => ({ id: id.slice(0, 100), shown: shown[k] === '1' }));
  return { groups: kind && TODAY_KINDS.includes(kind) ? { [kind]: items } : {} };
}

/** Settings > Coach: the two texts as typed (up to 2000, the door tidies them as app.), and the parts switched on when the form had them. */
function coachBody(f: Fields): Body {
  const text = (name: string) => {
    const v = f.get(name);
    return typeof v === 'string' ? v.slice(0, 2000) : undefined;
  };
  const on = (name: string) => f.getAll(name).filter((x): x is string => typeof x === 'string').slice(0, 20);
  return { goals: text('goals'), style: text('style'), parts: f.get('parts') === '1' ? { day: on('day'), week: on('week') } : undefined };
}

/** The Nudges form: every switch true or false ("1"), every hours field a number (a field not a number is left out: as now). */
/** A form field as text, or undefined (a file or none). */
const fieldOf = (f: Fields) => (name: string) => {
  const v = f.get(name);
  return typeof v === 'string' ? v : undefined;
};

/** The ten values of a food (docs/API.md, the Catalogue's values form), as the door names them. */
export const CATALOGUE_VALUES = ['kcal', 'protein', 'fat', 'sat_fat', 'carbs', 'fibre', 'sugar_total', 'sugar_added', 'sodium_mg', 'caffeine_mg'] as const;

/** A food's number (a value, a unit's grams): "12.5" or "12,5" as 12.5; anything else as typed (the door then answers 400). */
function foodNumber(f: Fields, name: string): number | string | null {
  const t = str(f, name, 20);
  if (t === undefined) return null;
  const n = t.replace(',', '.');
  return /^\d{1,6}(\.\d{1,4})?$/.test(n) ? Number(n) : t;
}

/** A text of Medical's forms: left out when the form did not send it, null when it came empty (the door: null is empty), else as typed. */
function typed(f: Fields, name: string, limit: number): string | null | undefined {
  const v = f.get(name);
  if (typeof v !== 'string') return undefined;
  const t = v.trim().slice(0, limit);
  return t === '' ? null : t;
}

/** A date of Medical's forms: left out, null when empty, else yyyy-mm-dd (anything else is sent as null: the door asks for the date). */
function typedDate(f: Fields, name: string): string | null | undefined {
  const v = f.get(name);
  if (typeof v !== 'string') return undefined;
  const t = v.trim();
  return /^\d{4}-\d\d-\d\d$/.test(t) ? t : null;
}

const confirmedOf = (f: Fields): true | undefined => (f.get('confirmed') === '1' ? true : undefined);

/** A date field (yyyy-mm-dd), or left out (the door then says it is missing). */
function dateOf(f: Fields, name: string): string | undefined {
  const t = str(f, name, 10);
  return t && /^\d{4}-\d\d-\d\d$/.test(t) ? t : undefined;
}

/** A job's pairs: the form's "3-1,7-2" (app.'s own format) as the door's [[3, 1], [7, 2]] (1 to 12); anything else is left out. */
function pairsOf(f: Fields): number[][] | undefined {
  const t = str(f, 'pairs', 300);
  if (!t || !/^\d{1,9}-\d{1,9}(,\d{1,9}-\d{1,9}){0,11}$/.test(t)) return undefined;
  return t.split(',').map((p) => p.split('-').map(Number));
}

/** "Done it earlier?": 1 to 7 (days ago) as a number, or a date yyyy-mm-dd; anything else as typed (the door refuses it). */
function whenOf(f: Fields): number | string | undefined {
  const t = str(f, 'when', 10);
  if (t === undefined) return undefined;
  return /^[1-7]$/.test(t) ? Number(t) : t;
}

/** A history entry's ids as the door's numbers: "7,9" (1 to 20); anything else is left out. */
function idsOf(f: Fields): number[] | undefined {
  const t = str(f, 'ids', 300);
  if (!t || !/^\d{1,12}(,\d{1,12}){0,19}$/.test(t)) return undefined;
  return t.split(',').map(Number);
}

const raw = (f: Fields, name: string): string => {
  const v = f.get(name);
  return typeof v === 'string' ? v : '';
};

/** A zone form's body: its name and tile label as typed, its spots a line each and its words with commas as lists (docs/API.md `zonenew`). */
function zoneBody(f: Fields): Body {
  return { name: str(f, 'name', 200) ?? '', short: str(f, 'short', 200) ?? '', spots: linesOf(raw(f, 'spots')), words: wordsOfText(raw(f, 'words')) };
}

/** A chore form's body (`chorenew`, `choreedit`): the zone is a zone's id, or null for the whole flat ("flat"); minutes empty = null (the door: 15). */
function choreBody(f: Fields): Body {
  const zone = str(f, 'zone_id', 12);
  const minutes = str(f, 'minutes', 12);
  return {
    name: str(f, 'name', 200) ?? '',
    zone_id: zone === 'flat' ? null : zone !== undefined && /^\d{1,12}$/.test(zone) ? Number(zone) : undefined,
    days: int(f, 'days'),
    minutes: minutes === undefined ? null : /^\d{1,12}$/.test(minutes) ? Number(minutes) : minutes,
    steps: linesOf(raw(f, 'steps')),
    howto: str(f, 'howto', 400) ?? null,
    words: wordsOfText(raw(f, 'words')),
  };
}

/** The Per zone table: the zones listed in `zone_ids`, each with on (ticked), days and minutes (blank = null = the chore's own). */
function zonesOf(f: Fields): Body[] | undefined {
  const ids = f.getAll('zone_ids').slice(0, 100);
  if (!ids.every((id) => typeof id === 'string' && /^\d{1,12}$/.test(id))) return undefined;
  const whole = (name: string): number | string | null => {
    const t = str(f, name, 12);
    return t === undefined ? null : /^\d{1,12}$/.test(t) ? Number(t) : t;
  };
  return ids.map((id) => ({ zone_id: Number(id), on: f.get(`on_${id}`) === '1', days: whole(`days_${id}`), minutes: whole(`min_${id}`) }));
}

/**
 * A habit's reminder (hours after waking): a field left out stays as it is (undefined, not sent), an empty one clears it (null), a number
 * as a JSON number, anything else as typed (the door refuses it in plain words).
 */
function remindAfter(f: Fields): number | string | null | undefined {
  const v = f.get('remind_after');
  if (typeof v !== 'string') return undefined;
  const t = v.trim().slice(0, 20).replace(',', '.');
  if (t === '') return null;
  return /^\d{1,3}(\.\d{1,3})?$/.test(t) ? Number(t) : t;
}

/**
 * One of the Habits page's list forms (docs/API.md, /habits/manage): only the fields its action takes, as numbers and true or
 * false where the door wants them (it refuses `on` or `track` that are not true or false, so they go only where they belong).
 */
function manageBody(f: Fields): Body {
  const action = str(f, 'action', 10);
  const name = str(f, 'name', 64);
  const label = (): string | undefined => {
    const v = str(f, 'label', 200);
    return v === undefined ? undefined : v.split(/\s+/).join(' ');
  };
  switch (action) {
    case 'track':
      return { action, name, on: f.get('on') === '1' };
    case 'edit': {
      const aim = str(f, 'aim', 10);
      return {
        action,
        name,
        label: label(),
        target: int(f, 'target'),
        order: int(f, 'order'),
        aim: aim === 'do' || aim === 'avoid' ? aim : undefined,
        remind_after: remindAfter(f),
      };
    }
    case 'delete':
      return { action, name, confirmed: f.get('confirmed') === '1' ? true : undefined };
    case 'new':
      return { action, label: label(), group: str(f, 'group', 20), target: int(f, 'target'), track: f.get('track') === '1' };
    default: // retire, restore (an unknown action is the door's 400)
      return { action, name };
  }
}

/** A number of a gym form: empty is null (not given); a number as a JSON number; anything else as typed (the door refuses it). */
function gymNumber(f: Fields, name: string): number | string | null {
  const t = str(f, name, 20);
  if (t === undefined) return null;
  return /^\d{1,6}(\.\d{1,3})?$/.test(t) ? Number(t) : t;
}

/** The two yeses of a read-back (deploy 92): confirmed (an odd value) and confirm_delete (a value cleared). */
function yes(f: Fields): Body {
  return { confirmed: f.get('confirmed') === '1' ? true : undefined, confirm_delete: f.get('confirm_delete') === '1' ? true : undefined };
}

/** The two sets of names are the same (the table's and the bodies'): the type check fails otherwise. */
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
const sameNames: Same<keyof typeof BODIES, SaveName> = true;
void sameNames;

type Saves = { [K in SaveName]: (typeof BODIES)[K] & { path: (typeof SAVE_RULES)[K]['path']; keyed: boolean; timeoutMs?: number } };
/** Each save: the table's route, whether a key goes with it and the server's wait for a `long` one, with its body (and check, read first). */
export const SAVES = Object.fromEntries(
  SAVE_NAMES.map((n) => {
    const rule: SaveRule = SAVE_RULES[n];
    return [n, { ...BODIES[n], path: rule.path, keyed: rule.key !== 'none', ...(rule.long ? { timeoutMs: LONG_TIMEOUT_MS } : {}) }];
  }),
) as Saves;

export { SAVE_NAMES, type SaveName };

/**
 * Each page's form actions, from the table's `pages` (src/lib/saverules.ts; its SAVE_PAGES say which addresses each page is). The order
 * is the table's and means nothing: a page's actions are an object by name.
 */
const on = (page: SavePage): SaveName[] => savesOn(page);
/** Today (src/routes/(app)): its taps, the logging box, a food row opened in place, the Coach card, Undo. */
export const TODAY_SAVES = on('today');
/** The Food day (src/routes/(app)/food): a row's change and note, a meal's note, "Save as usual meal", Undo. */
export const FOOD_SAVES = on('food');
/** The Usual meals page (src/routes/(app)/library/usual since deploy 105). */
export const USUAL_SAVES = on('usual');
/** The Health page (deploy 92, src/routes/(app)/health): a day's row, a body session, Undo. */
export const HEALTH_SAVES = on('health');
/** The Habits page (deploy 94, src/routes/(app)/habits): Today's tick (the same save, asked for the habits read), a calendar day, the list's forms, Undo. */
export const HABITS_SAVES = on('habits');
/** The Gym's Workout page (deploy 96, src/routes/(app)/gym): a tick, a remove, the day pick, + Add exercise, Undo. */
export const GYM_SAVES = on('gym');
/** The Plan part (deploy 97, src/routes/(app)/gym/plan): the plan's exercises and days, Undo (of a take-off). */
export const PLAN_SAVES = on('gym_plan');
/** The Exercises part (deploy 97, src/routes/(app)/gym/exercises) and Library's Exercises tab: Rename, Retire or Bring back, + New exercise. No Undo. */
export const EXERCISES_SAVES = on('exercises');
/** Home's Now page (deploy 99, src/routes/(app)/home): the tick circle, Undo. */
export const HOME_SAVES = on('home');
/** The Pick page (deploy 99, src/routes/(app)/home/pick): the timer, Done, Done next job, Not today, Done it earlier?, Undo. */
export const PICK_SAVES = on('home_pick');
/** Zones (deploy 100, src/routes/(app)/home/zones): the tick of a tile or a row, All done, a starting point's chips, Undo. */
export const ZONES_SAVES = on('home_zones');
/** History (deploy 100, src/routes/(app)/home/history): the × of a row, + Add one done earlier, Undo. */
export const HISTORY_SAVES = on('home_history');
/** Edit zones (deploy 100, src/routes/(app)/home/edit): the goal, the zone and chore forms, Retire and Bring back, the Per zone table. No Undo. */
export const EDIT_SAVES = on('home_edit');
/** The Trends page (deploy 102, src/routes/(app)/trends): the Week review's button. No Undo. */
export const TRENDS_SAVES = on('trends');
/** The Coach page (deploy 109, src/routes/(app)/coach): the day coaching's button (Today's Coach card posts it to Today's own action). */
export const COACH_SAVES = on('coach');
/**
 * Library's Foods tab (deploy 105, src/routes/(app)/library): the Catalogue's six forms, and a new food through the look-up and its yes
 * (`lookup`, `answer`, here asked for the Catalogue; the yes has the door's Undo of the new food). The six have no Undo.
 */
export const CATALOGUE_SAVES = on('catalogue');
/** Library > Foods > Words (core item 24, src/routes/(app)/library/words): the word save, asked for view "words" (with an Undo), and Undo. */
export const WORDS_SAVES = on('words');
/** Library's Habits tab (deploy 105, src/routes/(app)/library/habits): the list's forms, as on the Habits page. */
export const LIBRARY_HABITS_SAVES = on('library_habits');
/** Medical's Reports page (deploy 106, src/routes/(app)/medical): a value, a report's date, title, lab and notes. No Undo. */
export const MEDICAL_REPORTS_SAVES = on('medical_reports');
/** The Medication page: its form and End, and a new course through Today's typed line and its yes (`log`, `answer`), Undo. */
export const MEDICAL_MEDS_SAVES = on('medical_meds');
/** Settings' tabs (deploy 111, src/routes/(app)/settings/*). None has a key or Undo, and none is in Today's actions. */
export const SETTINGS_TARGETS_SAVES = on('settings_targets');
export const SETTINGS_TODAY_SAVES = on('settings_today');
export const SETTINGS_BODY_SAVES = on('settings_body');
export const SETTINGS_COACH_SAVES = on('settings_coach');
export const SETTINGS_DEVICES_SAVES = on('settings_devices');
export const SETTINGS_NOTIFY_SAVES = on('settings_notify');
export const SETTINGS_ONLY: SaveName[] = [
  ...SETTINGS_TARGETS_SAVES,
  ...SETTINGS_TODAY_SAVES,
  ...SETTINGS_BODY_SAVES,
  ...SETTINGS_COACH_SAVES,
  ...SETTINGS_DEVICES_SAVES,
  ...SETTINGS_NOTIFY_SAVES,
];
export type View = 'day' | 'food' | 'usual' | 'health' | 'body' | 'habits' | 'gym' | 'gym_plan' | 'gym_exercises' | 'home' | 'home_pick' | 'home_zones' | 'home_history' | 'home_chore' | 'home_edit' | 'week' | 'coach' | 'catalogue' | 'words' | 'labs' | 'labs_tests' | 'labs_meds'
  | 'settings_targets' | 'settings_today' | 'settings_body' | 'settings_coach' | 'settings_devices' | 'settings_notify';

/** A key as the browser makes them (src/lib/saver.ts): a random UUID or base64url; anything else is replaced. */
const KEY = /^[A-Za-z0-9_-]{16,64}$/;

/** The door's body for a save: the form's fields, the key where the route takes one, and the fresh Today (or Food day) in the answer. */
export function bodyFor(
  name: SaveName,
  f: Fields,
  viewDay: string | undefined,
  newKey: () => string = () => crypto.randomUUID(),
  view: View = 'day',
  asked: Asked = {},
): Body {
  const save: Save = SAVES[name];
  const body: Body = { ...save.body(f, asked), view };
  if (viewDay && /^\d{4}-\d\d-\d\d$/.test(viewDay)) body.view_day = viewDay;
  // The Health page's fresh read (deploy 92): its range (7, 30 or 90) and "Show all".
  if (view === 'health' || view === 'body') {
    const range = str(f, 'range', 3);
    if (range && ['7', '30', '90'].includes(range)) body.range = Number(range);
    if (view === 'health' && f.get('all') === '1') body.all = true;
  }
  // The Habits page's fresh read (deploy 94): the filter of "Your habits".
  if (view === 'habits') {
    const show = str(f, 'show', 10);
    if (show && (SHOWS as readonly string[]).includes(show)) body.show = show;
  }
  // Home's fresh read (deploy 99): Now's time (view_min), Pick's time and job (view_min, view_n), as the page's address has them.
  if (view === 'home' || view === 'home_pick') {
    const min = str(f, 'view_min', 3);
    if (min && /^\d{1,3}$/.test(min)) body.view_min = Number(min);
    const n = str(f, 'view_n', 4);
    if (view === 'home_pick' && n && /^\d{1,4}$/.test(n)) body.view_n = Number(n);
  }
  // History's fresh read (deploy 100): how many rows it shows (?n=, 60 to 600); a chore's page: the chore.
  if (view === 'home_history') {
    const limit = str(f, 'view_limit', 4);
    if (limit && /^\d{1,4}$/.test(limit)) body.view_limit = Number(limit);
  }
  if (view === 'home_chore') {
    const id = str(f, 'view_id', 12);
    if (id && /^\d{1,12}$/.test(id)) body.view_id = Number(id);
  }
  // The Week's fresh read (deploy 102): the page's period (?p=), so the answer brings the Week on screen.
  if (view === 'week') {
    const p = str(f, 'view_p', 4);
    if (p && ['7', 'last', '30', 'this'].includes(p)) body.view_p = p;
  }
  // The Coach page's fresh read (deploy 109): the page's filter (view_f); the card's day is view_day (set above).
  if (view === 'coach') {
    const fl = str(f, 'view_f', 10);
    if (fl && (FILTERS as readonly string[]).includes(fl)) body.view_f = fl;
  }
  // The Catalogue's fresh read (deploy 105): the page's search, filter, order and open food (?q=, ?f=, ?s=, ?food=), so the answer
  // brings the list and the box on screen as the page shows them.
  if (view === 'catalogue') {
    const q = str(f, 'view_q', 60);
    if (q) body.view_q = q;
    const fl = str(f, 'view_f', 10);
    if (fl && (CATALOGUE_FILTERS as readonly string[]).includes(fl)) body.view_f = fl;
    const so = str(f, 'view_s', 10);
    if (so && (CATALOGUE_SORTS as readonly string[]).includes(so)) body.view_s = so;
    const food = str(f, 'view_food', 12);
    if (food && /^[Nn]?\d{1,9}$/.test(food)) body.view_food = Number(food.replace(/^[Nn]/, ''));
  }
  // The words review's fresh read (core item 24): the page's search and chip (?q=, ?shared=1).
  if (view === 'words') {
    const q = str(f, 'view_q', 60);
    if (q) body.view_q = q;
    if (f.get('view_shared') === '1') body.view_shared = true;
  }
  // Medical's fresh read (deploy 106): the Reports page's open report (view_open, R12 as the door says it), or the Tests page's search and test.
  if (view === 'labs') {
    const open = askedOpen(str(f, 'view_open', 12) ?? null);
    if (open) body.view_open = `R${open}`;
  }
  if (view === 'labs_tests') {
    const q = str(f, 'view_q', 60);
    if (q) body.view_q = q;
    const t = askedTest(str(f, 'view_t', 12) ?? null);
    if (t) body.view_t = String(t);
  }
  if (save.keyed) {
    const key = str(f, 'key', 64);
    // A form sent without the page's script has no key: one is made here (a re-send of that form is then a new save).
    body.key = key && KEY.test(key) ? key : newKey();
  }
  for (const k of Object.keys(body)) if (body[k] === undefined) delete body[k];
  return body;
}

export type SaveResult<A> =
  | { ok: true; answer: A; expiresAt: string | null }
  | { ok: false; status: number; signedOut: boolean; message: string; problem?: ProblemKind; unsure?: boolean };

/**
 * One save through the door. Signed out: signedOut, so the page can keep the tap and sign in. The door off or the core down
 * (step F): "Not saved." with the plain words of src/lib/problems.ts (the session stays). No answer in time (Web 65): unsure, it
 * may have been saved. Another error: the door's own message.
 */
export async function runSave<A>(
  door: Door,
  session: string,
  name: SaveName,
  f: Fields,
  viewDay?: string,
  view: View = 'day',
  asked: Asked = {},
): Promise<SaveResult<A>> {
  const save: Save = SAVES[name];
  if (save.before) {
    // A read first (Web 70). Its failure comes before the save was sent: nothing was saved, whatever the kind.
    try {
      asked = { ...asked, ...(await save.before(door, session)) };
    } catch (error) {
      const kind = problemOf(error);
      if (kind === 'signed_out') return { ok: false, status: 401, signedOut: true, message: error instanceof DoorError ? error.message : 'Sign in again.' };
      return { ok: false, status: 503, signedOut: false, message: problemText(kind, 'save'), problem: kind };
    }
  }
  const wrong = save.check?.(f, asked);
  if (wrong) return { ok: false, status: 400, signedOut: false, message: wrong };
  try {
    const { body, expiresAt } = await door.post<A>(save.path, session, bodyFor(name, f, viewDay, undefined, view, asked), save.timeoutMs);
    return { ok: true, answer: body, expiresAt };
  } catch (error) {
    const kind = problemOf(error);
    if (kind === 'signed_out') {
      return { ok: false, status: 401, signedOut: true, message: error instanceof DoorError ? error.message : 'Sign in again.' };
    }
    // Web 65: the call went out and the door did not answer in time: it may have been saved (unsure; the browser keeps the key).
    if (error instanceof DoorError && error.code === 'no_answer') {
      return { ok: false, status: 504, signedOut: false, message: unsureText(replays(save.keyed, name, f.get('action') === 'untick')), problem: 'core_down', unsure: true };
    }
    if (kind === 'door_off' || kind === 'core_down') {
      return { ok: false, status: 503, signedOut: false, message: problemText(kind, 'save'), problem: kind };
    }
    if (error instanceof DoorError) return { ok: false, status: error.status || 502, signedOut: false, message: error.message, problem: kind };
    return { ok: false, status: 500, signedOut: false, message: 'Something went wrong. Nothing was saved.', problem: kind };
  }
}
