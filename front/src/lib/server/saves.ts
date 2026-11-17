/**
 * Today's saves (step C, deploy 80; the logging box's typed line since step D, deploy 81), the Food day's (step E, deploy 84) and
 * the Usual meals page's (deploy 87):
 * which form action calls which door route with which body (docs/API.md, "Saves").
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
import { problemOf, problemText, type ProblemKind } from '../problems.js';
import { labeladdBody } from '../scan.js';
import { bodyValues, healthValues } from '../health.js';
import { SHOWS } from '../habits.js';
import { VALS, wordsOf } from '../gym.js';
import { linesOf, wordsOfText } from '../homeparts.js';
import { CATALOGUE_FILTERS, CATALOGUE_SORTS } from '../catalogue.js';
import { askedOpen, askedTest } from '../medical.js';
import { FILTERS } from '../coach.js';
import { hoursOf, NUDGE_HOURS, NUDGE_KEYS } from '../settings.js';
import { subscriptionProblem } from '../pushdevice.js';

/** The form's fields: what `FormData` offers (and a plain test double). */
export interface Fields {
  get(name: string): FormDataEntryValue | null;
  getAll(name: string): FormDataEntryValue[];
}

type Body = Record<string, unknown>;

/** What the form action knows besides the form (deploy 112): the browser's User-Agent header, for /push/subscribe's device name. */
export interface Asked {
  userAgent?: string | null;
}

interface Save {
  path: string;
  /** The door's route takes a re-send key (docs/API.md): a re-sent tap then saves once. */
  keyed: boolean;
  body: (f: Fields, asked: Asked) => Body;
  /** Why the form cannot go to the door (checked first; the door is not asked): "Not saved." with these words. */
  check?: (f: Fields) => string | null;
  /** /log and /held/retry read the words with the AI: up to about 40 s. */
  timeoutMs?: number;
}

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

export const SAVES = {
  // A typed line, as many lines as the box holds (each can be its own entry); 4000 characters as app.'s box (webentry.MAX_TEXT).
  log: { path: '/log', keyed: true, body: (f) => ({ text: str(f, 'text', 4000) }), timeoutMs: 60_000 },
  water: { path: '/water', keyed: true, body: (f) => ({ ml: int(f, 'ml') }) },
  // an Again chip; the scan sheet's "Log" (deploy 90) also sends the time (hh:mm)
  again: {
    path: '/again',
    keyed: true,
    body: (f) => ({ food_id: str(f, 'food_id', 12), amount: str(f, 'amount', 20), time: str(f, 'time', 5) }),
  },
  usual: { path: '/usual', keyed: true, body: (f) => ({ meal_id: str(f, 'meal_id', 12) }) },
  habit: {
    path: '/habit',
    keyed: true,
    body: (f) => ({ name: str(f, 'name', 64), action: str(f, 'action', 10), ref: str(f, 'ref', 20) }),
  },
  checkin: {
    path: '/checkin',
    keyed: true,
    body: (f) => ({ type: str(f, 'type', 10), value: str(f, 'value', 3), day: str(f, 'day', 10) }),
  },
  health: {
    path: '/health',
    keyed: true,
    body: (f) => ({
      row: str(f, 'row', 20),
      ref: str(f, 'ref', 20),
      v1: str(f, 'v1', 20),
      v2: str(f, 'v2', 20),
      time: str(f, 'time', 5),
      confirmed: f.get('confirmed') === '1' ? true : undefined,
    }),
  },
  answer: { path: '/answer', keyed: false, body: (f) => ({ question_id: str(f, 'question_id', 64), reply: str(f, 'reply', 2000) }) },
  review: {
    path: '/review',
    keyed: false,
    body: (f) =>
      str(f, 'action', 5) === 'all'
        ? { action: 'all', refs: f.getAll('refs').filter((r): r is string => typeof r === 'string').slice(0, 200) }
        : { action: str(f, 'action', 5), ref: str(f, 'ref', 20) },
  },
  held_retry: { path: '/held/retry', keyed: true, body: (f) => ({ id: int(f, 'id') }), timeoutMs: 60_000 },
  held_delete: { path: '/held/delete', keyed: true, body: (f) => ({ id: int(f, 'id') }) },
  undo: { path: '/undo', keyed: false, body: (f) => ({ token: str(f, 'token', 200) }) },
  // The Food day (step E): change a row (amount in a unit, time hh:mm, another food by its name) or delete it; an odd value is
  // read back first (then the same with confirmed). The door's routes take no key: a change made twice is caught as on app.
  food_entry: {
    path: '/food/entry',
    keyed: false,
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
  food_note: { path: '/food/note', keyed: false, body: (f) => ({ ref: str(f, 'ref', 12), note: str(f, 'note', 300) ?? '' }) },
  // The Usual meals page (deploy 87): one Save changes a meal (its name and the whole list of foods, in order) or deletes it;
  // made at once with Undo, so the front end always sends confirmed (the door would read it back first otherwise).
  usual_meal: {
    path: '/usual/meal',
    keyed: true,
    body: (f) => {
      const action = str(f, 'action', 10);
      const base = { meal_id: int(f, 'meal_id'), action, confirmed: true };
      return action === 'save' ? { ...base, name: str(f, 'name', 200) ?? '', items: items(f) } : base;
    },
  },
  // A new usual meal or drink from foods (1 to 8, as app.).
  usual_new: {
    path: '/usual/new',
    keyed: true,
    body: (f) => ({ name: str(f, 'name', 200) ?? '', drink: f.get('drink') === '1', items: items(f) }),
  },
  // "Save as usual meal" on a meal of the Food day (not the drinks, meal 0): the day, the meal's number and a name.
  usual_from_meal: {
    path: '/usual/from_meal',
    keyed: true,
    body: (f) => ({ day: str(f, 'day', 10), meal: int(f, 'meal'), name: str(f, 'name', 200) ?? '' }),
  },
  // The scan sheet (deploy 90): the checked values of a label photo or of Open Food Facts as a new food, logged at once with an
  // amount (Undo takes back the entry only); a key saves once (src/lib/scan.ts makes the body).
  labeladd: { path: '/food/labeladd', keyed: true, body: (f) => labeladdBody(f) },
  // "Look it up" on a food question under Needs you: the words typed in its field, or none (the door then looks up the question's
  // word); the food found is read back as a question (Yes through /answer). An AI call picks the best fit: up to 60 s.
  lookup: {
    path: '/lookup',
    keyed: false,
    body: (f) => ({ text: str(f, 'text', 200), question_id: str(f, 'question_id', 64) }),
    timeoutMs: 60_000,
  },
  // The Health page (deploy 92): one day's row (only the rows changed: `values`), a body session (only the measures changed). A
  // value cleared is read back first (Yes = confirm_delete), then an odd value (Yes = confirmed, keeping confirm_delete).
  health_day: {
    path: '/health/day',
    keyed: true,
    body: (f) => ({ day: str(f, 'day', 10), values: healthValues(f), ...yes(f) }),
  },
  body: { path: '/body', keyed: true, body: (f) => ({ day: str(f, 'day', 10), values: bodyValues(f), ...yes(f) }) },
  // The Habits page (deploy 94): a square of the calendar (a day with fewer ticks than the habit's times a day gets one, a done day
  // has its ticks taken off) and the list's forms. The key is new per tap but the day tap is never sent again by the page: the
  // door does not replay it (a re-sent key would untick, docs/API.md). The list's forms have no Undo.
  habit_day: { path: '/habit/day', keyed: true, body: (f) => ({ name: str(f, 'name', 64), day: str(f, 'day', 10) }) },
  habits_manage: { path: '/habits/manage', keyed: true, body: (f) => manageBody(f) },
  // Today's "Not today" on "Body measurements due": hidden until the next health day (no key, no Undo).
  body_skip: { path: '/body/skip', keyed: false, body: () => ({}) },
  // The Gym's Workout page (deploy 96): the door's /gym/<action> takes numbers as JSON numbers and ids as numbers. Only the tick
  // takes a key (app.'s rule); the page never sends a gym save again by itself (saver.ts, NEVER_RESENT). Each answers with the
  // Workout read (view "gym").
  gym_tick: {
    path: '/gym/tick',
    keyed: true,
    body: (f) => ({ exercise_id: int(f, 'exercise_id'), ...Object.fromEntries(VALS.map((k) => [k, gymNumber(f, k)])) }),
  },
  // one logged row (set_id), or all of today's rows of an exercise (a done circle: exercise_id); the door wants one of them
  gym_remove: {
    path: '/gym/remove',
    keyed: false,
    body: (f) => (str(f, 'set_id', 12) !== undefined ? { set_id: int(f, 'set_id') } : { exercise_id: int(f, 'exercise_id') }),
  },
  // a day of the split, or Free workout (day_id null: the field empty)
  gym_pick: { path: '/gym/pick', keyed: false, body: (f) => ({ day_id: str(f, 'day_id', 12) === undefined ? null : int(f, 'day_id') }) },
  // + Add exercise on the Workout page: today true puts it on today's day of the split; other words typed with commas
  gym_new: {
    path: '/gym/new',
    keyed: false,
    body: (f) => ({ name: str(f, 'name', 60) ?? '', kind: str(f, 'kind', 20), words: wordsOf(str(f, 'words', 600) ?? ''), today: f.get('today') === '1' ? true : undefined }),
  },
  // The Plan part (deploy 97): a day's exercises and the days of the split. None takes a key, none has Undo but itemremove. Each
  // answers with the Plan read (view "gym_plan"). Ids are numbers; sets and reps as JSON numbers, both null for no plan numbers.
  gym_itemset: {
    path: '/gym/itemset',
    keyed: false,
    body: (f) => ({ item_id: int(f, 'item_id'), sets: gymNumber(f, 'sets'), reps: gymNumber(f, 'reps') }),
  },
  gym_itemmove: { path: '/gym/itemmove', keyed: false, body: (f) => ({ item_id: int(f, 'item_id'), dir: str(f, 'dir', 4) }) },
  gym_itemremove: { path: '/gym/itemremove', keyed: false, body: (f) => ({ item_id: int(f, 'item_id') }) },
  // sets and reps both or neither: the door says so
  gym_itemadd: {
    path: '/gym/itemadd',
    keyed: false,
    body: (f) => ({ day_id: int(f, 'day_id'), exercise_id: int(f, 'exercise_id'), sets: gymNumber(f, 'sets'), reps: gymNumber(f, 'reps') }),
  },
  gym_daynew: { path: '/gym/daynew', keyed: false, body: (f) => ({ name: str(f, 'name', 40) ?? '' }) },
  gym_dayedit: { path: '/gym/dayedit', keyed: false, body: (f) => ({ day_id: int(f, 'day_id'), name: str(f, 'name', 40) ?? '' }) },
  // Remove a day (on 0) or bring it back (on 1): the door wants true or false
  gym_dayactive: { path: '/gym/dayactive', keyed: false, body: (f) => ({ day_id: int(f, 'day_id'), on: f.get('on') === '1' }) },
  // The Exercises part (deploy 97): Rename, Retire or Bring back (+ New exercise is gym_new without today). Each answers with the
  // Exercises read (view "gym_exercises"); no key, no Undo.
  gym_rename: { path: '/gym/rename', keyed: false, body: (f) => ({ exercise_id: int(f, 'exercise_id'), name: str(f, 'name', 60) ?? '' }) },
  gym_active: { path: '/gym/active', keyed: false, body: (f) => ({ exercise_id: int(f, 'exercise_id'), on: f.get('on') === '1' }) },
  // Home's Now and Pick pages (deploy 99): the door's /home/<action> takes ids as numbers and pairs as [[chore_id, zone_id], ...].
  // Only tick, pickdone, picknext and earlier take a key (home._once); the page never sends a Home save again by itself (saver.ts).
  // A tick toggles: a pair done today is ticked off again. Each answers with its page's read (view "home" or "home_pick").
  home_tick: { path: '/home/tick', keyed: true, body: (f) => ({ chore_id: int(f, 'chore_id'), zone_id: int(f, 'zone_id') }) },
  // the Pick page's timer: start (the job's pairs and the page's minutes), pause, resume, stop (its id)
  home_start: { path: '/home/start', keyed: false, body: (f) => ({ pairs: pairsOf(f), minutes: int(f, 'minutes') }) },
  home_pause: { path: '/home/pause', keyed: false, body: (f) => ({ timer_id: int(f, 'timer_id') }) },
  home_resume: { path: '/home/resume', keyed: false, body: (f) => ({ timer_id: int(f, 'timer_id') }) },
  home_stop: { path: '/home/stop', keyed: false, body: (f) => ({ timer_id: int(f, 'timer_id') }) },
  // "Done" (the timer's id may come along), "Done, next job" (running only), "Not today", "Done it earlier?" (1 to 7 days ago, or a date)
  home_pickdone: { path: '/home/pickdone', keyed: true, body: (f) => ({ pairs: pairsOf(f), timer_id: int(f, 'timer_id') }) },
  home_picknext: { path: '/home/picknext', keyed: true, body: (f) => ({ pairs: pairsOf(f), timer_id: int(f, 'timer_id') }) },
  home_skip: { path: '/home/skip', keyed: false, body: (f) => ({ pairs: pairsOf(f) }) },
  home_earlier: { path: '/home/earlier', keyed: true, body: (f) => ({ pairs: pairsOf(f), when: whenOf(f) }) },
  // Home's other four pages (deploy 100). Zones: "All done" on a whole-flat chore and a starting point's chips (both keyed, both with
  // Undo; the tile and the row's tick are home_tick). History: the × on a row (no key; its ids as numbers, Undo puts them back) and
  // "+ Add one done earlier" (home_earlier). Edit zones: the weekly goal, the zone and chore forms, Retire and Bring back and the Per
  // zone table: none takes a key, none has Undo. Each answers with its page's read (view "home_zones", "home_history", "home_edit").
  home_alldone: { path: '/home/alldone', keyed: true, body: (f) => ({ chore_id: int(f, 'chore_id') }) },
  home_startpoint: { path: '/home/startpoint', keyed: true, body: (f) => ({ pairs: pairsOf(f), ago: str(f, 'ago', 10) }) },
  home_remove: { path: '/home/remove', keyed: false, body: (f) => ({ ids: idsOf(f) }) },
  home_goalset: { path: '/home/goalset', keyed: false, body: (f) => ({ goal: int(f, 'goal') }) },
  home_zonenew: { path: '/home/zonenew', keyed: false, body: (f) => zoneBody(f) },
  home_zoneedit: { path: '/home/zoneedit', keyed: false, body: (f) => ({ zone_id: int(f, 'zone_id'), ...zoneBody(f) }) },
  home_zoneactive: { path: '/home/zoneactive', keyed: false, body: (f) => ({ zone_id: int(f, 'zone_id'), on: f.get('on') === '1' }) },
  home_chorenew: { path: '/home/chorenew', keyed: false, body: (f) => choreBody(f) },
  home_choreedit: { path: '/home/choreedit', keyed: false, body: (f) => ({ chore_id: int(f, 'chore_id'), ...choreBody(f) }) },
  home_choreactive: { path: '/home/choreactive', keyed: false, body: (f) => ({ chore_id: int(f, 'chore_id'), on: f.get('on') === '1' }) },
  home_chorezones: { path: '/home/chorezones', keyed: false, body: (f) => ({ chore_id: int(f, 'chore_id'), zones: zonesOf(f) }) },
  // The Week review's button (deploy 102, the Trends page): POST /coach/start with the card's period. The door takes NO key and the
  // page never sends it again by itself (saver.ts: not keyed, never kept; a review costs about 20 cents). kind is always "week" (the
  // door has no day coaching yet). It answers with the coaching and the fresh Week of the page's period (view "week", view_p). The
  // core only starts the AI in the background, but the door is given 60 s, so a slow answer is not mistaken for "not saved".
  coach_start: {
    path: '/coach/start',
    keyed: false,
    body: (f) => ({ kind: 'week', start: dateOf(f, 'start'), end: dateOf(f, 'end') }),
    timeoutMs: 60_000,
  },
  // The Coach card's button (deploy 109, Today and the Coach page): POST /coach/start with kind "day", the day twice. The door takes NO
  // key and the page never sends it again by itself (saver.ts: not keyed, never kept; a day coaching costs about 6 cents). Today's
  // answer brings the fresh Today (view "day", view_day), the Coach page's the fresh Coach page (view "coach", view_f, view_day).
  // The Week review's own (`coach_start`, Trends) stays as it is.
  coach_day: {
    path: '/coach/start',
    keyed: false,
    body: (f) => {
      const day = dateOf(f, 'start');
      return { kind: 'day', start: day, end: day };
    },
    timeoutMs: 60_000,
  },
  // Library's Foods tab (deploy 105): the Catalogue's six forms at /food/catalogue/<action> (docs/API.md). The door takes NO key and
  // has no Undo; the page never sends one again by itself (saver.ts: `catalogue_`). Ids and values as JSON numbers, ticks as true or
  // false. Each answers with the fresh Catalogue and the open food's box (view "catalogue" with view_q, view_f, view_s, view_food).
  // values: only the values the owner changed (one left out stays as it is); shown first, then the same with confirmed.
  catalogue_values: {
    path: '/food/catalogue/values',
    keyed: false,
    body: (f) => ({
      id: int(f, 'id'),
      ...Object.fromEntries(CATALOGUE_VALUES.filter((k) => str(f, k, 20) !== undefined).map((k) => [k, foodNumber(f, k)])),
      past: f.get('past') === '1',
      confirmed: f.get('confirmed') === '1' ? true : undefined,
    }),
  },
  catalogue_words: { path: '/food/catalogue/words', keyed: false, body: (f) => ({ id: int(f, 'id'), act: str(f, 'act', 10), word: str(f, 'word', 60) ?? '' }) },
  catalogue_barcode: { path: '/food/catalogue/barcode', keyed: false, body: (f) => ({ id: int(f, 'id'), barcode: str(f, 'barcode', 40) ?? '' }) },
  // name, drink, hide: the form comes filled in, so all three are sent (the door keeps one left out as it is)
  catalogue_basics: {
    path: '/food/catalogue/basics',
    keyed: false,
    body: (f) => ({ id: int(f, 'id'), name: str(f, 'name', 120) ?? '', drink: f.get('drink') === '1', hide: f.get('hide') === '1' }),
  },
  // a unit and its weight (grams, or ml for a drink); empty grams is null (the door then asks for it)
  catalogue_unit: {
    path: '/food/catalogue/unit',
    keyed: false,
    body: (f) => ({ id: int(f, 'id'), unit: str(f, 'unit', 30) ?? '', grams: str(f, 'grams', 20) === undefined ? null : foodNumber(f, 'grams') }),
  },
  catalogue_reviewed: { path: '/food/catalogue/reviewed', keyed: false, body: (f) => ({ id: int(f, 'id') }) },
  // Medical's three forms (deploy 106, docs/API.md "Medical's saves"): a correction of a lab value, of a report's date, title, lab and notes,
  // and of a medication course (or its End). The door takes NO key and has no Undo; the page never sends one again by itself (saver.ts:
  // `labs_`, not after a sign-in either). Each is shown first (needs_confirmation, its read-back in the answer bar), then the same with
  // confirmed. Only the fields typed over are sent (one left out stays as it is); a cleared one goes as null (empty). The answer brings
  // the fresh read (view "labs" with view_open, "labs_meds").
  labs_value: {
    path: '/labs/value',
    keyed: false,
    body: (f) => ({ id: int(f, 'id'), value: typed(f, 'value', 60), unit: typed(f, 'unit', 30), ref: typed(f, 'ref', 60), confirmed: confirmedOf(f) }),
  },
  labs_report: {
    path: '/labs/report',
    keyed: false,
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
    path: '/labs/med',
    keyed: false,
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
  settings_targets: { path: '/settings/targets', keyed: false, body: (f) => targetsBody(f) },
  // One tap on the Today page tab: its whole group, in the order wanted (the form's id and shown fields, pair by pair).
  settings_today: { path: '/settings/today', keyed: false, body: (f) => todayBody(f) },
  settings_today_reset: { path: '/settings/today_reset', keyed: false, body: () => ({}) },
  settings_height: { path: '/settings/height', keyed: false, body: (f) => ({ valid_from: dateOf(f, 'valid_from'), height: decimalOf(f, 'height') }) },
  // the measures shown always go (none ticked is app.'s "Keep at least one measure.")
  settings_body: {
    path: '/settings/body',
    keyed: false,
    body: (f) => ({ interval: decimalOf(f, 'interval'), show: f.getAll('show').filter((x): x is string => typeof x === 'string').slice(0, 10) }),
  },
  settings_coach: { path: '/settings/coach', keyed: false, body: (f) => coachBody(f) },
  settings_device: { path: '/settings/device', keyed: false, body: (f) => ({ id: str(f, 'id', 64) }) },
  settings_others: { path: '/settings/others', keyed: false, body: () => ({}) },
  settings_nudges: { path: '/settings/nudges', keyed: false, body: (f) => nudgesBody(f) },
  // the notifications of a device (here or at app.) off; a test to every device
  push_off: { path: '/push/off', keyed: false, body: (f) => ({ id: int(f, 'id') }) },
  push_test: { path: '/push/test', keyed: false, body: () => ({}) },
  // Notifications on this device (deploy 112): the browser's subscription from "This device" (src/lib/pushdevice.ts), checked here
  // first (an https address of up to 1000 characters, the two keys base64url of up to 200 and 100); the device's name comes from the
  // browser's User-Agent header, which the page does not send itself. The door checks the push service and the keys as app. does.
  push_subscribe: {
    path: '/push/subscribe',
    keyed: false,
    check: (f) => subscriptionProblem({ endpoint: f.get('endpoint'), p256dh: f.get('p256dh'), auth: f.get('auth') }),
    body: (f, asked) => ({
      endpoint: f.get('endpoint'),
      keys: { p256dh: f.get('p256dh'), auth: f.get('auth') },
      user_agent: (asked.userAgent ?? '').slice(0, 300) || undefined,
    }),
  },
} satisfies Record<string, Save>;

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
function nudgesBody(f: Fields): Body {
  const body: Body = {};
  const flag = (name: string) => {
    const v = f.get(name);
    return typeof v === 'string' ? v === '1' : undefined;
  };
  body.on = flag('on');
  for (const k of NUDGE_KEYS) body[k] = flag(k);
  for (const k of NUDGE_HOURS) {
    const v = f.get(k);
    body[k] = hoursOf(typeof v === 'string' ? v : undefined);
  }
  return body;
}

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
      return { action, name, label: label(), target: int(f, 'target'), order: int(f, 'order'), aim: aim === 'do' || aim === 'avoid' ? aim : undefined };
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

export type SaveName = keyof typeof SAVES;
export const SAVE_NAMES = Object.keys(SAVES) as SaveName[];
/** The Food day's form actions (src/routes/(app)/food), the Usual meals page's (src/routes/(app)/library/usual since deploy 105); Today has all the others. */
export const FOOD_SAVES: SaveName[] = ['food_entry', 'food_note', 'usual_from_meal', 'undo'];
export const USUAL_SAVES: SaveName[] = ['usual_meal', 'usual_new', 'undo'];
/** The Health page's (deploy 92, src/routes/(app)/health): a day's row, a body session, Undo. */
export const HEALTH_SAVES: SaveName[] = ['health_day', 'body', 'undo'];
/** The Habits page's (deploy 94, src/routes/(app)/habits): Today's tick (the same save, asked for the habits read), a calendar day, the list's forms, Undo. */
export const HABITS_SAVES: SaveName[] = ['habit', 'habit_day', 'habits_manage', 'undo'];
const HABITS_ONLY: SaveName[] = ['habit_day', 'habits_manage'];
/** The Gym's Workout page's (deploy 96, src/routes/(app)/gym): a tick, a remove, the day pick, + Add exercise, Undo. */
export const GYM_SAVES: SaveName[] = ['gym_tick', 'gym_remove', 'gym_pick', 'gym_new', 'undo'];
/** The Plan part's (deploy 97, src/routes/(app)/gym/plan): the plan's exercises and days, Undo (of a take-off). */
export const PLAN_SAVES: SaveName[] = ['gym_itemset', 'gym_itemmove', 'gym_itemremove', 'gym_itemadd', 'gym_daynew', 'gym_dayedit', 'gym_dayactive', 'undo'];
/** The Exercises part's (deploy 97, src/routes/(app)/gym/exercises): Rename, Retire or Bring back, + New exercise. No Undo exists for them. */
export const EXERCISES_SAVES: SaveName[] = ['gym_rename', 'gym_active', 'gym_new'];
const GYM_ONLY: SaveName[] = [...GYM_SAVES, ...PLAN_SAVES, ...EXERCISES_SAVES];
/** Home's Now page's (deploy 99, src/routes/(app)/home): the tick circle, Undo. */
export const HOME_SAVES: SaveName[] = ['home_tick', 'undo'];
/** The Pick page's (deploy 99, src/routes/(app)/home/pick): the timer, Done, Done next job, Not today, Done it earlier?, Undo. */
export const PICK_SAVES: SaveName[] = ['home_start', 'home_pause', 'home_resume', 'home_stop', 'home_pickdone', 'home_picknext', 'home_skip', 'home_earlier', 'undo'];
/** Zones' (deploy 100, src/routes/(app)/home/zones): the tick of a tile or a row, All done, a starting point's chips, Undo. */
export const ZONES_SAVES: SaveName[] = ['home_tick', 'home_alldone', 'home_startpoint', 'undo'];
/** History's (deploy 100, src/routes/(app)/home/history): the × of a row, + Add one done earlier, Undo. */
export const HISTORY_SAVES: SaveName[] = ['home_remove', 'home_earlier', 'undo'];
/** Edit zones' (deploy 100, src/routes/(app)/home/edit): the goal, the zone and chore forms, Retire and Bring back, the Per zone table. No Undo exists for them. */
export const EDIT_SAVES: SaveName[] = ['home_goalset', 'home_zonenew', 'home_zoneedit', 'home_zoneactive', 'home_chorenew', 'home_choreedit', 'home_choreactive', 'home_chorezones'];
const HOME_ONLY: SaveName[] = [...HOME_SAVES, ...PICK_SAVES, ...ZONES_SAVES, ...HISTORY_SAVES, ...EDIT_SAVES];
/** The Trends page's (deploy 102, src/routes/(app)/trends): the Week review's button. No Undo exists for it. */
export const TRENDS_SAVES: SaveName[] = ['coach_start'];
/**
 * The Coach page's (deploy 109, src/routes/(app)/coach): the day coaching's button. Today has it too (`coach_day` is not in any "only"
 * list, so TODAY_SAVES keeps it by exclusion, as it must: Today's Coach card posts it to Today's own form action).
 */
export const COACH_SAVES: SaveName[] = ['coach_day'];
/**
 * Library's Foods tab's (deploy 105, src/routes/(app)/library): the Catalogue's six forms, and a new food through the look-up and its
 * yes (`lookup`, `answer`: Today's saves, here asked for the Catalogue; the yes has the door's Undo of the new food). The six have no
 * Undo.
 */
const CATALOGUE_ONLY: SaveName[] = ['catalogue_values', 'catalogue_words', 'catalogue_barcode', 'catalogue_basics', 'catalogue_unit', 'catalogue_reviewed'];
export const CATALOGUE_SAVES: SaveName[] = [...CATALOGUE_ONLY, 'lookup', 'answer', 'undo'];
/** Library's Habits tab's (deploy 105, src/routes/(app)/library/habits): the list's forms, as on the Habits page. */
export const LIBRARY_HABITS_SAVES: SaveName[] = ['habits_manage'];
/**
 * Medical's (deploy 106, src/routes/(app)/medical): the Reports page's two forms (a value, a report's date, title, lab and notes), and the
 * Medication page's form and End, with a new course through Today's typed line and its yes (`log`, `answer`, asked for the Medication
 * read; the door's Undo comes with them, if any). The three Medical forms have no Undo.
 */
const MEDICAL_ONLY: SaveName[] = ['labs_value', 'labs_report', 'labs_med'];
export const MEDICAL_REPORTS_SAVES: SaveName[] = ['labs_value', 'labs_report'];
export const MEDICAL_MEDS_SAVES: SaveName[] = ['labs_med', 'log', 'answer', 'undo'];
/**
 * Settings' tabs (deploy 111, src/routes/(app)/settings/*): Food targets, the Today page (a group's tap, Show everything again), Body
 * (height, the measurements), Coach, Devices (sign one out, all others), Notifications (the nudges, a device's off, the test). None has
 * a key or Undo, and none is in Today's actions.
 */
export const SETTINGS_TARGETS_SAVES: SaveName[] = ['settings_targets'];
export const SETTINGS_TODAY_SAVES: SaveName[] = ['settings_today', 'settings_today_reset'];
export const SETTINGS_BODY_SAVES: SaveName[] = ['settings_height', 'settings_body'];
export const SETTINGS_COACH_SAVES: SaveName[] = ['settings_coach'];
export const SETTINGS_DEVICES_SAVES: SaveName[] = ['settings_device', 'settings_others'];
export const SETTINGS_NOTIFY_SAVES: SaveName[] = ['settings_nudges', 'push_off', 'push_test', 'push_subscribe'];
export const SETTINGS_ONLY: SaveName[] = [
  ...SETTINGS_TARGETS_SAVES,
  ...SETTINGS_TODAY_SAVES,
  ...SETTINGS_BODY_SAVES,
  ...SETTINGS_COACH_SAVES,
  ...SETTINGS_DEVICES_SAVES,
  ...SETTINGS_NOTIFY_SAVES,
];
export const TODAY_SAVES: SaveName[] = SAVE_NAMES.filter(
  (n) =>
    n === 'undo' ||
    (!FOOD_SAVES.includes(n) && !USUAL_SAVES.includes(n) && !HEALTH_SAVES.includes(n) && !HABITS_ONLY.includes(n) && !GYM_ONLY.includes(n) && !HOME_ONLY.includes(n) && !TRENDS_SAVES.includes(n) && !CATALOGUE_ONLY.includes(n) && !MEDICAL_ONLY.includes(n) && !SETTINGS_ONLY.includes(n)),
);
export type View = 'day' | 'food' | 'usual' | 'health' | 'body' | 'habits' | 'gym' | 'gym_plan' | 'gym_exercises' | 'home' | 'home_pick' | 'home_zones' | 'home_history' | 'home_chore' | 'home_edit' | 'week' | 'coach' | 'catalogue' | 'labs' | 'labs_tests' | 'labs_meds'
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
  | { ok: false; status: number; signedOut: boolean; message: string; problem?: ProblemKind };

/**
 * One save through the door. Signed out: signedOut, so the page can keep the tap and sign in. The door off or the core down
 * (step F): "Not saved." with the plain words of src/lib/problems.ts (the session stays). Another error: the door's own message.
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
  const wrong = save.check?.(f);
  if (wrong) return { ok: false, status: 400, signedOut: false, message: wrong };
  try {
    const { body, expiresAt } = await door.post<A>(save.path, session, bodyFor(name, f, viewDay, undefined, view, asked), save.timeoutMs);
    return { ok: true, answer: body, expiresAt };
  } catch (error) {
    const kind = problemOf(error);
    if (kind === 'signed_out') {
      return { ok: false, status: 401, signedOut: true, message: error instanceof DoorError ? error.message : 'Sign in again.' };
    }
    if (kind === 'door_off' || kind === 'core_down') {
      return { ok: false, status: 503, signedOut: false, message: problemText(kind, 'save'), problem: kind };
    }
    if (error instanceof DoorError) return { ok: false, status: error.status || 502, signedOut: false, message: error.message, problem: kind };
    return { ok: false, status: 500, signedOut: false, message: 'Something went wrong. Nothing was saved.', problem: kind };
  }
}
