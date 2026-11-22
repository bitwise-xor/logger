// How every save behaves, written down once as it was on 22.11.2026 (web item 72, before its table): a characterization test. It
// must pass unchanged before and after the refactor, so it reads only the names the rest of the code imports (SAVES and the page
// lists of saves.ts, KEYED, mayResend, waitMs, SLOW and noAnswerText of saver.ts, replays of problems.ts) and the page files'
// own `formActions(<list>, …)` line. A change of behaviour must change a line below on purpose.
//
// Per action: the door path; keyed (the browser and the server send a key); resend (kept and sent again after a sign-in);
// replays (the "no answer" words say a second send is safe; replaysUntick the same for an untick); unsure (the paid coaching's own
// "no answer" words); slow (its answer is never dropped for a newer tap's); waitMs (the browser's wait); timeoutMs (the server's
// wait for the door); pages (the addresses whose form actions take it); core (what the core does with a key, read in
// core/app/api.py and the functions it calls on 22.11.2026: 'once' = saved once per key, a re-send gets the first answer back;
// 'never_replays' = the key is used but the message carries the click's time, so a re-sent key is refused or is the next click;
// 'none' = the route takes no key, or takes one and its function does not use it).
import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DEFAULT_TIMEOUT_MS } from './door.js';
import * as saves from './saves.js';
import { SAVE_NAMES, SAVES } from './saves.js';
import { KEYED, mayResend, noAnswerText, SLOW, waitMs } from '../saver.js';
import { replays } from '../problems.js';

type Core = 'once' | 'never_replays' | 'none';
interface Behaviour {
  path: string;
  keyed: boolean;
  resend: boolean;
  replays: boolean;
  replaysUntick: boolean;
  unsure: boolean;
  slow: boolean;
  waitMs: number;
  timeoutMs: number;
  pages: string[];
  core: Core;
}

const BEHAVIOUR: Record<string, Behaviour> = {
  log: { path: '/log', keyed: true, resend: true, replays: true, replaysUntick: true, unsure: false, slow: true, waitMs: 65_000, timeoutMs: 60_000, pages: ['/', '/medical/meds'], core: 'once' },
  water: { path: '/water', keyed: true, resend: true, replays: true, replaysUntick: true, unsure: false, slow: false, waitMs: 20_000, timeoutMs: 15_000, pages: ['/'], core: 'once' },
  again: { path: '/again', keyed: true, resend: true, replays: true, replaysUntick: true, unsure: false, slow: false, waitMs: 20_000, timeoutMs: 15_000, pages: ['/'], core: 'once' },
  usual: { path: '/usual', keyed: true, resend: true, replays: true, replaysUntick: true, unsure: false, slow: false, waitMs: 20_000, timeoutMs: 15_000, pages: ['/'], core: 'once' },
  habit: { path: '/habit', keyed: true, resend: true, replays: true, replaysUntick: false, unsure: false, slow: false, waitMs: 20_000, timeoutMs: 15_000, pages: ['/', '/habits'], core: 'once' },
  checkin: { path: '/checkin', keyed: true, resend: true, replays: true, replaysUntick: true, unsure: false, slow: false, waitMs: 20_000, timeoutMs: 15_000, pages: ['/'], core: 'once' },
  health: { path: '/health', keyed: true, resend: true, replays: true, replaysUntick: true, unsure: false, slow: false, waitMs: 20_000, timeoutMs: 15_000, pages: ['/'], core: 'once' },
  answer: { path: '/answer', keyed: false, resend: false, replays: false, replaysUntick: false, unsure: false, slow: false, waitMs: 20_000, timeoutMs: 15_000, pages: ['/', '/library', '/medical/meds'], core: 'none' },
  review: { path: '/review', keyed: false, resend: false, replays: false, replaysUntick: false, unsure: false, slow: false, waitMs: 20_000, timeoutMs: 15_000, pages: ['/'], core: 'none' },
  held_retry: { path: '/held/retry', keyed: true, resend: true, replays: true, replaysUntick: true, unsure: false, slow: true, waitMs: 65_000, timeoutMs: 60_000, pages: ['/'], core: 'none' },
  held_delete: { path: '/held/delete', keyed: true, resend: true, replays: true, replaysUntick: true, unsure: false, slow: false, waitMs: 20_000, timeoutMs: 15_000, pages: ['/'], core: 'none' },
  undo: { path: '/undo', keyed: false, resend: false, replays: false, replaysUntick: false, unsure: false, slow: false, waitMs: 20_000, timeoutMs: 15_000, pages: ['/', '/food', '/gym', '/gym/plan', '/habits', '/health', '/home', '/home/history', '/home/pick', '/home/zones', '/library', '/library/usual', '/library/words', '/medical/meds'], core: 'none' },
  food_entry: { path: '/food/entry', keyed: false, resend: false, replays: false, replaysUntick: false, unsure: false, slow: false, waitMs: 20_000, timeoutMs: 15_000, pages: ['/', '/food'], core: 'none' },
  food_note: { path: '/food/note', keyed: false, resend: false, replays: false, replaysUntick: false, unsure: false, slow: false, waitMs: 20_000, timeoutMs: 15_000, pages: ['/', '/food'], core: 'none' },
  food_mealnote: { path: '/food/mealnote', keyed: false, resend: false, replays: false, replaysUntick: false, unsure: false, slow: false, waitMs: 20_000, timeoutMs: 15_000, pages: ['/food'], core: 'none' },
  usual_meal: { path: '/usual/meal', keyed: true, resend: true, replays: true, replaysUntick: true, unsure: false, slow: false, waitMs: 20_000, timeoutMs: 15_000, pages: ['/library/usual'], core: 'once' },
  usual_new: { path: '/usual/new', keyed: true, resend: true, replays: true, replaysUntick: true, unsure: false, slow: false, waitMs: 20_000, timeoutMs: 15_000, pages: ['/library/usual'], core: 'once' },
  usual_from_meal: { path: '/usual/from_meal', keyed: true, resend: true, replays: true, replaysUntick: true, unsure: false, slow: false, waitMs: 20_000, timeoutMs: 15_000, pages: ['/food'], core: 'once' },
  labeladd: { path: '/food/labeladd', keyed: true, resend: true, replays: true, replaysUntick: true, unsure: false, slow: false, waitMs: 20_000, timeoutMs: 15_000, pages: ['/'], core: 'once' },
  lookup: { path: '/lookup', keyed: false, resend: false, replays: false, replaysUntick: false, unsure: false, slow: true, waitMs: 65_000, timeoutMs: 60_000, pages: ['/', '/library'], core: 'none' },
  health_day: { path: '/health/day', keyed: true, resend: true, replays: true, replaysUntick: true, unsure: false, slow: false, waitMs: 20_000, timeoutMs: 15_000, pages: ['/health'], core: 'once' },
  body: { path: '/body', keyed: true, resend: true, replays: true, replaysUntick: true, unsure: false, slow: false, waitMs: 20_000, timeoutMs: 15_000, pages: ['/health'], core: 'once' },
  habit_day: { path: '/habit/day', keyed: true, resend: false, replays: false, replaysUntick: false, unsure: false, slow: false, waitMs: 20_000, timeoutMs: 15_000, pages: ['/habits'], core: 'never_replays' },
  habits_manage: { path: '/habits/manage', keyed: true, resend: true, replays: false, replaysUntick: false, unsure: false, slow: false, waitMs: 20_000, timeoutMs: 15_000, pages: ['/habits', '/library/habits'], core: 'none' },
  body_skip: { path: '/body/skip', keyed: false, resend: false, replays: false, replaysUntick: false, unsure: false, slow: false, waitMs: 20_000, timeoutMs: 15_000, pages: ['/'], core: 'none' },
  gym_tick: { path: '/gym/tick', keyed: true, resend: false, replays: true, replaysUntick: true, unsure: false, slow: false, waitMs: 20_000, timeoutMs: 15_000, pages: ['/gym'], core: 'once' },
  gym_remove: { path: '/gym/remove', keyed: false, resend: false, replays: false, replaysUntick: false, unsure: false, slow: false, waitMs: 20_000, timeoutMs: 15_000, pages: ['/gym'], core: 'none' },
  gym_pick: { path: '/gym/pick', keyed: false, resend: false, replays: false, replaysUntick: false, unsure: false, slow: false, waitMs: 20_000, timeoutMs: 15_000, pages: ['/gym'], core: 'none' },
  gym_new: { path: '/gym/new', keyed: false, resend: false, replays: false, replaysUntick: false, unsure: false, slow: false, waitMs: 20_000, timeoutMs: 15_000, pages: ['/gym', '/gym/exercises', '/library/exercises'], core: 'none' },
  gym_itemset: { path: '/gym/itemset', keyed: false, resend: false, replays: false, replaysUntick: false, unsure: false, slow: false, waitMs: 20_000, timeoutMs: 15_000, pages: ['/gym/plan'], core: 'none' },
  gym_itemmove: { path: '/gym/itemmove', keyed: false, resend: false, replays: false, replaysUntick: false, unsure: false, slow: false, waitMs: 20_000, timeoutMs: 15_000, pages: ['/gym/plan'], core: 'none' },
  gym_itemremove: { path: '/gym/itemremove', keyed: false, resend: false, replays: false, replaysUntick: false, unsure: false, slow: false, waitMs: 20_000, timeoutMs: 15_000, pages: ['/gym/plan'], core: 'none' },
  gym_itemadd: { path: '/gym/itemadd', keyed: false, resend: false, replays: false, replaysUntick: false, unsure: false, slow: false, waitMs: 20_000, timeoutMs: 15_000, pages: ['/gym/plan'], core: 'none' },
  gym_daynew: { path: '/gym/daynew', keyed: false, resend: false, replays: false, replaysUntick: false, unsure: false, slow: false, waitMs: 20_000, timeoutMs: 15_000, pages: ['/gym/plan'], core: 'none' },
  gym_dayedit: { path: '/gym/dayedit', keyed: false, resend: false, replays: false, replaysUntick: false, unsure: false, slow: false, waitMs: 20_000, timeoutMs: 15_000, pages: ['/gym/plan'], core: 'none' },
  gym_dayactive: { path: '/gym/dayactive', keyed: false, resend: false, replays: false, replaysUntick: false, unsure: false, slow: false, waitMs: 20_000, timeoutMs: 15_000, pages: ['/gym/plan'], core: 'none' },
  gym_rename: { path: '/gym/rename', keyed: false, resend: false, replays: false, replaysUntick: false, unsure: false, slow: false, waitMs: 20_000, timeoutMs: 15_000, pages: ['/gym/exercises', '/library/exercises'], core: 'none' },
  gym_active: { path: '/gym/active', keyed: false, resend: false, replays: false, replaysUntick: false, unsure: false, slow: false, waitMs: 20_000, timeoutMs: 15_000, pages: ['/gym/exercises', '/library/exercises'], core: 'none' },
  home_tick: { path: '/home/tick', keyed: true, resend: false, replays: true, replaysUntick: true, unsure: false, slow: false, waitMs: 20_000, timeoutMs: 15_000, pages: ['/home', '/home/zones'], core: 'once' },
  home_start: { path: '/home/start', keyed: false, resend: false, replays: false, replaysUntick: false, unsure: false, slow: false, waitMs: 20_000, timeoutMs: 15_000, pages: ['/home/pick'], core: 'none' },
  home_pause: { path: '/home/pause', keyed: false, resend: false, replays: false, replaysUntick: false, unsure: false, slow: false, waitMs: 20_000, timeoutMs: 15_000, pages: ['/home/pick'], core: 'none' },
  home_resume: { path: '/home/resume', keyed: false, resend: false, replays: false, replaysUntick: false, unsure: false, slow: false, waitMs: 20_000, timeoutMs: 15_000, pages: ['/home/pick'], core: 'none' },
  home_stop: { path: '/home/stop', keyed: false, resend: false, replays: false, replaysUntick: false, unsure: false, slow: false, waitMs: 20_000, timeoutMs: 15_000, pages: ['/home/pick'], core: 'none' },
  home_pickdone: { path: '/home/pickdone', keyed: true, resend: false, replays: true, replaysUntick: true, unsure: false, slow: false, waitMs: 20_000, timeoutMs: 15_000, pages: ['/home/pick'], core: 'once' },
  home_picknext: { path: '/home/picknext', keyed: true, resend: false, replays: true, replaysUntick: true, unsure: false, slow: false, waitMs: 20_000, timeoutMs: 15_000, pages: ['/home/pick'], core: 'once' },
  home_skip: { path: '/home/skip', keyed: false, resend: false, replays: false, replaysUntick: false, unsure: false, slow: false, waitMs: 20_000, timeoutMs: 15_000, pages: ['/home/pick'], core: 'none' },
  home_earlier: { path: '/home/earlier', keyed: true, resend: false, replays: true, replaysUntick: true, unsure: false, slow: false, waitMs: 20_000, timeoutMs: 15_000, pages: ['/home/history', '/home/pick'], core: 'once' },
  home_alldone: { path: '/home/alldone', keyed: true, resend: false, replays: true, replaysUntick: true, unsure: false, slow: false, waitMs: 20_000, timeoutMs: 15_000, pages: ['/home/zones'], core: 'once' },
  home_startpoint: { path: '/home/startpoint', keyed: true, resend: false, replays: true, replaysUntick: true, unsure: false, slow: false, waitMs: 20_000, timeoutMs: 15_000, pages: ['/home/zones'], core: 'once' },
  home_remove: { path: '/home/remove', keyed: false, resend: false, replays: false, replaysUntick: false, unsure: false, slow: false, waitMs: 20_000, timeoutMs: 15_000, pages: ['/home/history'], core: 'none' },
  home_goalset: { path: '/home/goalset', keyed: false, resend: false, replays: false, replaysUntick: false, unsure: false, slow: false, waitMs: 20_000, timeoutMs: 15_000, pages: ['/home/edit'], core: 'none' },
  home_zonenew: { path: '/home/zonenew', keyed: false, resend: false, replays: false, replaysUntick: false, unsure: false, slow: false, waitMs: 20_000, timeoutMs: 15_000, pages: ['/home/edit'], core: 'none' },
  home_zoneedit: { path: '/home/zoneedit', keyed: false, resend: false, replays: false, replaysUntick: false, unsure: false, slow: false, waitMs: 20_000, timeoutMs: 15_000, pages: ['/home/edit'], core: 'none' },
  home_zoneactive: { path: '/home/zoneactive', keyed: false, resend: false, replays: false, replaysUntick: false, unsure: false, slow: false, waitMs: 20_000, timeoutMs: 15_000, pages: ['/home/edit'], core: 'none' },
  home_chorenew: { path: '/home/chorenew', keyed: false, resend: false, replays: false, replaysUntick: false, unsure: false, slow: false, waitMs: 20_000, timeoutMs: 15_000, pages: ['/home/edit'], core: 'none' },
  home_choreedit: { path: '/home/choreedit', keyed: false, resend: false, replays: false, replaysUntick: false, unsure: false, slow: false, waitMs: 20_000, timeoutMs: 15_000, pages: ['/home/edit'], core: 'none' },
  home_choreactive: { path: '/home/choreactive', keyed: false, resend: false, replays: false, replaysUntick: false, unsure: false, slow: false, waitMs: 20_000, timeoutMs: 15_000, pages: ['/home/edit'], core: 'none' },
  home_chorezones: { path: '/home/chorezones', keyed: false, resend: false, replays: false, replaysUntick: false, unsure: false, slow: false, waitMs: 20_000, timeoutMs: 15_000, pages: ['/home/edit'], core: 'none' },
  coach_start: { path: '/coach/start', keyed: false, resend: false, replays: false, replaysUntick: false, unsure: true, slow: false, waitMs: 65_000, timeoutMs: 60_000, pages: ['/trends'], core: 'none' },
  coach_day: { path: '/coach/start', keyed: false, resend: false, replays: false, replaysUntick: false, unsure: true, slow: false, waitMs: 65_000, timeoutMs: 60_000, pages: ['/', '/coach'], core: 'none' },
  catalogue_values: { path: '/food/catalogue/values', keyed: false, resend: false, replays: false, replaysUntick: false, unsure: false, slow: false, waitMs: 20_000, timeoutMs: 15_000, pages: ['/library'], core: 'none' },
  catalogue_words: { path: '/food/catalogue/words', keyed: false, resend: false, replays: false, replaysUntick: false, unsure: false, slow: false, waitMs: 20_000, timeoutMs: 15_000, pages: ['/library', '/library/words'], core: 'none' },
  catalogue_barcode: { path: '/food/catalogue/barcode', keyed: false, resend: false, replays: false, replaysUntick: false, unsure: false, slow: false, waitMs: 20_000, timeoutMs: 15_000, pages: ['/library'], core: 'none' },
  catalogue_basics: { path: '/food/catalogue/basics', keyed: false, resend: false, replays: false, replaysUntick: false, unsure: false, slow: false, waitMs: 20_000, timeoutMs: 15_000, pages: ['/library'], core: 'none' },
  catalogue_unit: { path: '/food/catalogue/unit', keyed: false, resend: false, replays: false, replaysUntick: false, unsure: false, slow: false, waitMs: 20_000, timeoutMs: 15_000, pages: ['/library'], core: 'none' },
  catalogue_reviewed: { path: '/food/catalogue/reviewed', keyed: false, resend: false, replays: false, replaysUntick: false, unsure: false, slow: false, waitMs: 20_000, timeoutMs: 15_000, pages: ['/library'], core: 'none' },
  labs_value: { path: '/labs/value', keyed: false, resend: false, replays: false, replaysUntick: false, unsure: false, slow: false, waitMs: 20_000, timeoutMs: 15_000, pages: ['/medical'], core: 'none' },
  labs_report: { path: '/labs/report', keyed: false, resend: false, replays: false, replaysUntick: false, unsure: false, slow: false, waitMs: 20_000, timeoutMs: 15_000, pages: ['/medical'], core: 'none' },
  labs_med: { path: '/labs/med', keyed: false, resend: false, replays: false, replaysUntick: false, unsure: false, slow: false, waitMs: 20_000, timeoutMs: 15_000, pages: ['/medical/meds'], core: 'none' },
  settings_targets: { path: '/settings/targets', keyed: false, resend: false, replays: false, replaysUntick: false, unsure: false, slow: false, waitMs: 20_000, timeoutMs: 15_000, pages: ['/settings/targets'], core: 'none' },
  settings_today: { path: '/settings/today', keyed: false, resend: false, replays: false, replaysUntick: false, unsure: false, slow: false, waitMs: 20_000, timeoutMs: 15_000, pages: ['/settings/today'], core: 'none' },
  settings_today_reset: { path: '/settings/today_reset', keyed: false, resend: false, replays: false, replaysUntick: false, unsure: false, slow: false, waitMs: 20_000, timeoutMs: 15_000, pages: ['/settings/today'], core: 'none' },
  settings_height: { path: '/settings/height', keyed: false, resend: false, replays: false, replaysUntick: false, unsure: false, slow: false, waitMs: 20_000, timeoutMs: 15_000, pages: ['/settings/body'], core: 'none' },
  settings_body: { path: '/settings/body', keyed: false, resend: false, replays: false, replaysUntick: false, unsure: false, slow: false, waitMs: 20_000, timeoutMs: 15_000, pages: ['/settings/body'], core: 'none' },
  settings_body_measure: { path: '/settings/body_measure', keyed: false, resend: false, replays: false, replaysUntick: false, unsure: false, slow: false, waitMs: 20_000, timeoutMs: 15_000, pages: ['/settings/body'], core: 'none' },
  settings_coach: { path: '/settings/coach', keyed: false, resend: false, replays: false, replaysUntick: false, unsure: false, slow: false, waitMs: 20_000, timeoutMs: 15_000, pages: ['/settings/coach'], core: 'none' },
  settings_device: { path: '/settings/device', keyed: false, resend: false, replays: false, replaysUntick: false, unsure: false, slow: false, waitMs: 20_000, timeoutMs: 15_000, pages: ['/settings/devices'], core: 'none' },
  settings_others: { path: '/settings/others', keyed: false, resend: false, replays: false, replaysUntick: false, unsure: false, slow: false, waitMs: 20_000, timeoutMs: 15_000, pages: ['/settings/devices'], core: 'none' },
  settings_nudges: { path: '/settings/nudges', keyed: false, resend: false, replays: false, replaysUntick: false, unsure: false, slow: false, waitMs: 20_000, timeoutMs: 15_000, pages: ['/settings/notifications'], core: 'none' },
  push_off: { path: '/push/off', keyed: false, resend: false, replays: false, replaysUntick: false, unsure: false, slow: false, waitMs: 20_000, timeoutMs: 15_000, pages: ['/settings/notifications'], core: 'none' },
  push_test: { path: '/push/test', keyed: false, resend: false, replays: false, replaysUntick: false, unsure: false, slow: false, waitMs: 20_000, timeoutMs: 15_000, pages: ['/settings/notifications'], core: 'none' },
  push_subscribe: { path: '/push/subscribe', keyed: false, resend: false, replays: false, replaysUntick: false, unsure: false, slow: false, waitMs: 20_000, timeoutMs: 15_000, pages: ['/settings/notifications'], core: 'none' },
};

/**
 * Where the front's key and the core's disagree (22.11.2026). Each is harmless and kept as it is: the browser sends a key the core
 * does not use, and a second send changes nothing.
 * - held_retry, held_delete: `webheld.retry` and `webheld.delete` take no key (docs/API.md lists one for /held/retry, none for
 *   /held/delete); a second send after the first went through is refused, "That message is no longer waiting", and changes nothing,
 *   so the words "it will not be saved twice" (replays) hold.
 * - habits_manage: `webhabits.ACTIONS` take a key and do not use it (docs/API.md: "accepted, but app.'s functions take none");
 *   replays is false for it, so its "no answer" words say to look first. It is kept for a re-send after a sign-in, which is safe:
 *   the save that met a gone session never reached the core's function.
 */
const FRONT_KEYED_CORE_NOT = ['habits_manage', 'held_delete', 'held_retry'];

/** The page files whose form actions are save lists: their address and their list's name. */
function pageLists(): Map<string, string> {
  const root = new URL('../../routes/(app)/', import.meta.url);
  const found = new Map<string, string>();
  for (const file of readdirSync(root, { recursive: true, encoding: 'utf8' })) {
    if (!file.endsWith('+page.server.ts')) continue;
    const list = /formActions\((\w+),/.exec(readFileSync(new URL(file, root), 'utf8'))?.[1];
    if (list) found.set('/' + file.replace(/\/?\+page\.server\.ts$/, ''), list);
  }
  return found;
}

describe('how every save behaves (22.11.2026, web item 72)', () => {
  it('names every save the server has, and no other', () => {
    expect([...SAVE_NAMES].sort()).toEqual(Object.keys(BEHAVIOUR).sort());
  });

  it.each(Object.entries(BEHAVIOUR))('%s', (name, b) => {
    const save = SAVES[name as keyof typeof SAVES] as { path: string; keyed: boolean; timeoutMs?: number };
    expect(save.path).toBe(b.path);
    expect(save.keyed).toBe(b.keyed);
    expect(KEYED.has(name)).toBe(b.keyed);
    expect(mayResend(name)).toBe(b.resend);
    expect(replays(KEYED.has(name), name)).toBe(b.replays);
    expect(replays(KEYED.has(name), name, true)).toBe(b.replaysUntick);
    expect(noAnswerText(name).includes('The coaching may have started anyway')).toBe(b.unsure);
    expect(SLOW.has(name)).toBe(b.slow);
    expect(waitMs(name)).toBe(b.waitMs);
    expect(save.timeoutMs ?? DEFAULT_TIMEOUT_MS).toBe(b.timeoutMs);
  });

  it('each save is taken by the pages listed, and by no other', () => {
    const lists = saves as unknown as Record<string, readonly string[]>;
    const taken = new Map<string, string[]>();
    for (const [page, list] of pageLists()) for (const name of lists[list] ?? []) taken.set(name, [...(taken.get(name) ?? []), page]);
    for (const [name, b] of Object.entries(BEHAVIOUR)) expect((taken.get(name) ?? []).sort(), name).toEqual(b.pages);
    expect([...taken.keys()].filter((n) => !(n in BEHAVIOUR))).toEqual([]);
  });

  it("the front's key agrees with the core's, but for the three listed (each harmless)", () => {
    const differ = Object.entries(BEHAVIOUR)
      .filter(([, b]) => b.keyed !== (b.core !== 'none'))
      .map(([n]) => n)
      .sort();
    expect(differ).toEqual(FRONT_KEYED_CORE_NOT);
    // no save the core keys goes without a key from the front
    expect(Object.entries(BEHAVIOUR).filter(([, b]) => b.core !== 'none' && !b.keyed)).toEqual([]);
    // a key the core never replays is never said to be safe to send again, nor sent again by the page
    for (const [n, b] of Object.entries(BEHAVIOUR).filter(([, b]) => b.core === 'never_replays')) {
      expect(b.replays, n).toBe(false);
      expect(b.resend, n).toBe(false);
    }
  });

  it('the browser waits a little longer than the server for every save, and the slow ones wait long', () => {
    for (const [n, b] of Object.entries(BEHAVIOUR)) {
      expect(b.waitMs - b.timeoutMs, n).toBe(5_000);
      if (b.slow) expect(b.timeoutMs, n).toBe(60_000);
    }
  });
});
