/**
 * How each save behaves, in one place (web item 72, 22.11.2026): per form action its door route, whether it goes with a key and what
 * the core does with that key, whether the browser keeps it and sends it again after a sign-in, how long the server and the browser
 * wait for its answer, whether its answer is ever dropped for a newer tap's, its own words when no answer came, and the pages whose
 * form actions take it. Everything else is made from this table: the browser's lists in src/lib/saver.ts (`KEYED`, `NEVER_RESENT`,
 * `mayResend`, `SLOW`, `waitMs`, the coaching's words), `replays` in src/lib/problems.ts, and in src/lib/server/saves.ts each save's
 * path, key and timeout and every page's list of actions (`TODAY_SAVES`, `FOOD_SAVES`, …). saves.ts keeps what goes to the door
 * (the bodies, the checks, a read first), under the same names; the type check fails when the two sets of names differ, when an
 * action has no page, or when a save without a key is marked to be sent again.
 *
 * Plain TypeScript with no import, so the browser and the server both read it.
 */

/** How long the server waits for the door's answer to a save marked `long` (the AI reads it, or it starts the coaching). */
export const LONG_TIMEOUT_MS = 60_000;
/**
 * How long the browser waits for a save's answer (Web 65): a little longer than the server waits for the door (15 s, the door
 * client's own; 60 s for the `long` ones), so the server's own "no answer in time" comes first.
 */
export const WAIT_MS = 20_000;
export const LONG_WAIT_MS = 65_000;

/**
 * The pages whose form actions save, each with the addresses that offer its actions (`formActions(<list>, …)` in their
 * +page.server.ts; savebehaviour.test.ts reads them).
 */
export const SAVE_PAGES = {
  today: ['/'],
  food: ['/food'],
  usual: ['/library/usual'],
  health: ['/health'],
  habits: ['/habits'],
  gym: ['/gym'],
  gym_plan: ['/gym/plan'],
  exercises: ['/gym/exercises', '/library/exercises'],
  home: ['/home'],
  home_pick: ['/home/pick'],
  home_zones: ['/home/zones'],
  home_history: ['/home/history'],
  home_edit: ['/home/edit'],
  trends: ['/trends'],
  coach: ['/coach'],
  catalogue: ['/library'],
  words: ['/library/words'],
  library_habits: ['/library/habits'],
  medical_reports: ['/medical'],
  medical_meds: ['/medical/meds'],
  settings_targets: ['/settings/targets'],
  settings_today: ['/settings/today'],
  settings_body: ['/settings/body'],
  settings_coach: ['/settings/coach'],
  settings_devices: ['/settings/devices'],
  settings_notify: ['/settings/notifications'],
} as const satisfies Record<string, readonly string[]>;
export type SavePage = keyof typeof SAVE_PAGES;

/**
 * The key of a save:
 * - `none`: no key goes with it (the door's route takes none, or ignores one).
 * - `replays`: a new key per tap, the same on a re-send; a second send with it gets the first answer back (`replayed`) or a
 *   refusal that changes nothing ("no longer waiting"), so "it will not be saved twice" is true (`replays` in problems.ts).
 * - `replays_tick`: the same for a tick; an untick takes no key at the core (Today's `habit`), so after no answer it is looked at
 *   first.
 * - `not_replayed`: a key goes with it, but the core does not replay it (a Habits page's day tap carries the click's time; the
 *   Habits list's forms take none at the core): after no answer it is looked at first.
 */
export type SaveKey = 'none' | 'replays' | 'replays_tick' | 'not_replayed';

interface Common {
  /** The door's route (docs/API.md, "Saves"), under /api/v1. */
  path: string;
  /** The pages whose form actions take it: at least one. */
  pages: readonly [SavePage, ...SavePage[]];
  /** The server waits LONG_TIMEOUT_MS for the door (else the door client's 15 s) and the browser LONG_WAIT_MS (else WAIT_MS). */
  long?: true;
  /** The AI reads it (up to about 40 s): its answer is never dropped for a tap made while it was read (saver.ts, SLOW). */
  slow?: true;
  /** A paid coaching start: after no answer its own words say to reload and look before pressing again (never sent again). */
  coaching?: true;
}

/**
 * resend: a tap that met a gone session is kept (sessionStorage, 10 minutes) and sent again with its key after the sign-in. Only
 * a keyed save can be; one without a key is never kept.
 */
export type SaveRule = Common & ({ key: 'none'; resend: false } | { key: Exclude<SaveKey, 'none'>; resend: boolean });

export const SAVE_RULES = {
  // Today's taps (step C) and the logging box's typed line (step D): each keyed, each sent again after a sign-in. A typed line and
  // "Try again" on a held line are read by the AI (60 s; their answer is never dropped). The Medication page's box is Today's `log`.
  log: { path: '/log', key: 'replays', resend: true, long: true, slow: true, pages: ['today', 'medical_meds'] },
  water: { path: '/water', key: 'replays', resend: true, pages: ['today'] },
  again: { path: '/again', key: 'replays', resend: true, pages: ['today'] },
  usual: { path: '/usual', key: 'replays', resend: true, pages: ['today'] },
  // Today's tick, and the Habits page's ticks (the same save, asked for the habits read)
  habit: { path: '/habit', key: 'replays_tick', resend: true, pages: ['today', 'habits'] },
  checkin: { path: '/checkin', key: 'replays', resend: true, pages: ['today'] },
  health: { path: '/health', key: 'replays', resend: true, pages: ['today'] },
  // a question's answer: Today's, and the yes of a new food (Library) or a new course (Medication) asked through it
  answer: { path: '/answer', key: 'none', resend: false, pages: ['today', 'catalogue', 'medical_meds'] },
  review: { path: '/review', key: 'none', resend: false, pages: ['today'] },
  // A held line's Try again and Delete: the core's functions take no key (docs/API.md lists one for /held/retry), but a second send
  // after the first went through is refused, "That message is no longer waiting", and changes nothing; so they count as replayed.
  held_retry: { path: '/held/retry', key: 'replays', resend: true, long: true, slow: true, pages: ['today'] },
  held_delete: { path: '/held/delete', key: 'replays', resend: true, pages: ['today'] },
  undo: {
    path: '/undo',
    key: 'none',
    resend: false,
    pages: ['today', 'food', 'usual', 'health', 'habits', 'gym', 'gym_plan', 'home', 'home_pick', 'home_zones', 'home_history', 'catalogue', 'words', 'medical_meds'],
  },
  // The Food day (step E) and a food row opened on Today (deploy 117): no key at the door (a change made twice is caught as on app.).
  food_entry: { path: '/food/entry', key: 'none', resend: false, pages: ['today', 'food'] },
  food_note: { path: '/food/note', key: 'none', resend: false, pages: ['today', 'food'] },
  food_mealnote: { path: '/food/mealnote', key: 'none', resend: false, pages: ['food'] },
  // The usual meals (deploy 87): the Usual meals page's, and the Food day's "Save as usual meal"
  usual_meal: { path: '/usual/meal', key: 'replays', resend: true, pages: ['usual'] },
  usual_new: { path: '/usual/new', key: 'replays', resend: true, pages: ['usual'] },
  usual_from_meal: { path: '/usual/from_meal', key: 'replays', resend: true, pages: ['food'] },
  // The scan sheet's new food (deploy 90): a key saves it once.
  labeladd: { path: '/food/labeladd', key: 'replays', resend: true, pages: ['today'] },
  // "Look it up" (Today's food question, Library's new food): no key, it saves nothing; an AI call picks the best fit (60 s).
  lookup: { path: '/lookup', key: 'none', resend: false, long: true, slow: true, pages: ['today', 'catalogue'] },
  // The Health page (deploy 92): a day's row and a body session.
  health_day: { path: '/health/day', key: 'replays', resend: true, pages: ['health'] },
  body: { path: '/body', key: 'replays', resend: true, pages: ['health'] },
  // The Habits page (deploy 94). A day tap's message carries the time of the click, so the door does not replay a re-sent key: sent
  // again while the day still needs a tick it is refused, sent after the day is done it unticks. It is never sent again by the page;
  // after a sign-in it is tapped again by hand. The list's forms (also Library's Habits tab) send a key the core's functions do not
  // use; one that met a gone session never reached them, so it is sent again after the sign-in.
  habit_day: { path: '/habit/day', key: 'not_replayed', resend: false, pages: ['habits'] },
  habits_manage: { path: '/habits/manage', key: 'not_replayed', resend: true, pages: ['habits', 'library_habits'] },
  // Today's "Not today" on "Body measurements due" (no key, no Undo).
  body_skip: { path: '/body/skip', key: 'none', resend: false, pages: ['today'] },
  // The Gym's Workout page (deploy 96). Only the tick takes a key (app.'s rule), and no gym save is ever sent again by the page, also
  // not after a sign-in: a set is logged by a tap seen to work, never behind your back; the others take no key, so a second send
  // would be a second change.
  gym_tick: { path: '/gym/tick', key: 'replays', resend: false, pages: ['gym'] },
  gym_remove: { path: '/gym/remove', key: 'none', resend: false, pages: ['gym'] },
  gym_pick: { path: '/gym/pick', key: 'none', resend: false, pages: ['gym'] },
  // + Add exercise on the Workout page, + New exercise on Exercises (Gym's part and Library's tab)
  gym_new: { path: '/gym/new', key: 'none', resend: false, pages: ['gym', 'exercises'] },
  // The Plan part (deploy 97): none takes a key.
  gym_itemset: { path: '/gym/itemset', key: 'none', resend: false, pages: ['gym_plan'] },
  gym_itemmove: { path: '/gym/itemmove', key: 'none', resend: false, pages: ['gym_plan'] },
  gym_itemremove: { path: '/gym/itemremove', key: 'none', resend: false, pages: ['gym_plan'] },
  gym_itemadd: { path: '/gym/itemadd', key: 'none', resend: false, pages: ['gym_plan'] },
  gym_daynew: { path: '/gym/daynew', key: 'none', resend: false, pages: ['gym_plan'] },
  gym_dayedit: { path: '/gym/dayedit', key: 'none', resend: false, pages: ['gym_plan'] },
  gym_dayactive: { path: '/gym/dayactive', key: 'none', resend: false, pages: ['gym_plan'] },
  // The Exercises part (deploy 97) and Library's Exercises tab: Rename, Retire or Bring back.
  gym_rename: { path: '/gym/rename', key: 'none', resend: false, pages: ['exercises'] },
  gym_active: { path: '/gym/active', key: 'none', resend: false, pages: ['exercises'] },
  // Home (deploys 99 and 100). Only tick, alldone, pickdone, picknext, earlier and startpoint take a key (home._once). No Home save
  // is ever sent again by the page, keyed or not: the timer's buttons and "Not today" take no key, a tick toggles, and a job is
  // marked done only by a tap seen to work; after a sign-in it is tapped again by hand.
  home_tick: { path: '/home/tick', key: 'replays', resend: false, pages: ['home', 'home_zones'] },
  home_start: { path: '/home/start', key: 'none', resend: false, pages: ['home_pick'] },
  home_pause: { path: '/home/pause', key: 'none', resend: false, pages: ['home_pick'] },
  home_resume: { path: '/home/resume', key: 'none', resend: false, pages: ['home_pick'] },
  home_stop: { path: '/home/stop', key: 'none', resend: false, pages: ['home_pick'] },
  home_pickdone: { path: '/home/pickdone', key: 'replays', resend: false, pages: ['home_pick'] },
  home_picknext: { path: '/home/picknext', key: 'replays', resend: false, pages: ['home_pick'] },
  home_skip: { path: '/home/skip', key: 'none', resend: false, pages: ['home_pick'] },
  home_earlier: { path: '/home/earlier', key: 'replays', resend: false, pages: ['home_pick', 'home_history'] },
  home_alldone: { path: '/home/alldone', key: 'replays', resend: false, pages: ['home_zones'] },
  home_startpoint: { path: '/home/startpoint', key: 'replays', resend: false, pages: ['home_zones'] },
  home_remove: { path: '/home/remove', key: 'none', resend: false, pages: ['home_history'] },
  home_goalset: { path: '/home/goalset', key: 'none', resend: false, pages: ['home_edit'] },
  home_zonenew: { path: '/home/zonenew', key: 'none', resend: false, pages: ['home_edit'] },
  home_zoneedit: { path: '/home/zoneedit', key: 'none', resend: false, pages: ['home_edit'] },
  home_zoneactive: { path: '/home/zoneactive', key: 'none', resend: false, pages: ['home_edit'] },
  home_chorenew: { path: '/home/chorenew', key: 'none', resend: false, pages: ['home_edit'] },
  home_choreedit: { path: '/home/choreedit', key: 'none', resend: false, pages: ['home_edit'] },
  home_choreactive: { path: '/home/choreactive', key: 'none', resend: false, pages: ['home_edit'] },
  home_chorezones: { path: '/home/chorezones', key: 'none', resend: false, pages: ['home_edit'] },
  // The Week review's button (deploy 102, Trends) and the day coaching's (deploy 109, Today's Coach card and the Coach page): no key,
  // never sent again by the page, also not after a sign-in or a network error (every start is read by the AI and costs about 20 or 6
  // cents). The core only starts the AI in the background, but the door is given 60 s, so a slow answer is not taken for "not saved".
  coach_start: { path: '/coach/start', key: 'none', resend: false, long: true, coaching: true, pages: ['trends'] },
  coach_day: { path: '/coach/start', key: 'none', resend: false, long: true, coaching: true, pages: ['today', 'coach'] },
  // Library's Foods tab (deploy 105), the Catalogue's six forms: no key at the door, no Undo. The word save also on the words review
  // (core item 24, Library > Foods > Words).
  catalogue_values: { path: '/food/catalogue/values', key: 'none', resend: false, pages: ['catalogue'] },
  catalogue_words: { path: '/food/catalogue/words', key: 'none', resend: false, pages: ['catalogue', 'words'] },
  catalogue_barcode: { path: '/food/catalogue/barcode', key: 'none', resend: false, pages: ['catalogue'] },
  catalogue_basics: { path: '/food/catalogue/basics', key: 'none', resend: false, pages: ['catalogue'] },
  catalogue_unit: { path: '/food/catalogue/unit', key: 'none', resend: false, pages: ['catalogue'] },
  catalogue_reviewed: { path: '/food/catalogue/reviewed', key: 'none', resend: false, pages: ['catalogue'] },
  // Medical's three forms (deploy 106): no key at the door, no Undo.
  labs_value: { path: '/labs/value', key: 'none', resend: false, pages: ['medical_reports'] },
  labs_report: { path: '/labs/report', key: 'none', resend: false, pages: ['medical_reports'] },
  labs_med: { path: '/labs/med', key: 'none', resend: false, pages: ['medical_meds'] },
  // Settings (deploy 111): no key (the door ignores one), no Undo; a sign-out of another device or a test notification happens once,
  // by a tap seen to work.
  settings_targets: { path: '/settings/targets', key: 'none', resend: false, pages: ['settings_targets'] },
  settings_today: { path: '/settings/today', key: 'none', resend: false, pages: ['settings_today'] },
  settings_today_reset: { path: '/settings/today_reset', key: 'none', resend: false, pages: ['settings_today'] },
  settings_height: { path: '/settings/height', key: 'none', resend: false, pages: ['settings_body'] },
  settings_body: { path: '/settings/body', key: 'none', resend: false, pages: ['settings_body'] },
  settings_body_measure: { path: '/settings/body_measure', key: 'none', resend: false, pages: ['settings_body'] },
  settings_coach: { path: '/settings/coach', key: 'none', resend: false, pages: ['settings_coach'] },
  settings_device: { path: '/settings/device', key: 'none', resend: false, pages: ['settings_devices'] },
  settings_others: { path: '/settings/others', key: 'none', resend: false, pages: ['settings_devices'] },
  settings_nudges: { path: '/settings/nudges', key: 'none', resend: false, pages: ['settings_notify'] },
  push_off: { path: '/push/off', key: 'none', resend: false, pages: ['settings_notify'] },
  push_test: { path: '/push/test', key: 'none', resend: false, pages: ['settings_notify'] },
  push_subscribe: { path: '/push/subscribe', key: 'none', resend: false, pages: ['settings_notify'] },
} as const satisfies Record<string, SaveRule>;

export type SaveName = keyof typeof SAVE_RULES;
export const SAVE_NAMES = Object.keys(SAVE_RULES) as SaveName[];

/** The rule of a form action by its name as the browser has it (a plain string), or none. */
export function ruleOf(action: string): SaveRule | undefined {
  return Object.hasOwn(SAVE_RULES, action) ? SAVE_RULES[action as SaveName] : undefined;
}

/** The names whose rule says so, in the table's order. */
export const savesWhere = (test: (rule: SaveRule) => boolean): SaveName[] => SAVE_NAMES.filter((n) => test(SAVE_RULES[n]));

/** A page's form actions. */
export const savesOn = (page: SavePage): SaveName[] => savesWhere((r) => r.pages.includes(page));
