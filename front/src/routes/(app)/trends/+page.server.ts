import { formActions } from '#lib/server/actions.js';
import { readDoor } from '#lib/server/read.js';
import { TRENDS_SAVES } from '#lib/server/saves.js';
import { askedPeriod, type Week } from '#lib/week.js';
import type { Actions, PageServerLoad } from './$types';

// Trends' Week tab (deploy 102) from GET /api/v1/week?p=7|last|30|this (7 without; another value in the address falls back to 7, as
// the other pages do with a bad query, so the door's 400 is never asked for). readDoor is the shared read of a door page: the session
// renewed, a gone session to the sign-in and back, any other trouble as a plain message.
export const load: PageServerLoad = async (event) => {
  const p = askedPeriod(event.url.searchParams.get('p'));
  const r = await readDoor<Week>(event, '/week', 'week', { p: p === '7' ? undefined : p });
  return { week: r.read, undo: r.undo, problem: r.problem ?? (r.missing ? 'trouble' : null), p };
};

/** The Week review's button: POST /coach/start, answered with the coaching and the fresh Week of the page's period (view "week"). */
export const actions = formActions(TRENDS_SAVES, 'week') as Actions;
