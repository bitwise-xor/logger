import { formActions } from '#lib/server/actions.js';
import { readDoor } from '#lib/server/read.js';
import { HISTORY_SAVES } from '#lib/server/saves.js';
import { askedNumber } from '#lib/home.js';
import type { History } from '#lib/homeparts.js';
import type { Actions, PageServerLoad } from './$types';

// Home's History page (deploy 100) from GET /api/v1/home/history?n=: what was ticked, by day, newest first (60 rows, ?n= more of
// them up to 600; the door clamps it).
export const load: PageServerLoad = async (event) => {
  const n = askedNumber(event.url.searchParams.get('n'), 4);
  const r = await readDoor<History>(event, '/home/history', 'home_history', { n: n || undefined });
  return { history: r.read, undo: r.undo, problem: r.problem };
};

/** The × of a row, "+ Add one done earlier" and Undo: each answers with the fresh History (view "home_history", with the page's limit). */
export const actions = formActions(HISTORY_SAVES, 'home_history') as Actions;
