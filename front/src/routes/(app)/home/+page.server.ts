import { formActions } from '#lib/server/actions.js';
import { readGym } from '#lib/server/gymread.js';
import { HOME_SAVES } from '#lib/server/saves.js';
import { askedNumber, type Now } from '#lib/home.js';
import type { Actions, PageServerLoad } from './$types';

// Home's Now page (deploy 99) from GET /api/v1/home?min=: the timer card, the time chips, This week, the chores waiting longest
// with their tick circles, Recently done. (readGym is the shared read of a door page since deploy 97: the session renewed, a gone
// session to the sign-in and back, any other trouble as a plain message.)
export const load: PageServerLoad = async (event) => {
  const min = askedNumber(event.url.searchParams.get('min'), 3);
  const r = await readGym<Now>(event, '/home', 'home', { min: min || undefined });
  return { now: r.read, undo: r.undo, problem: r.problem, min };
};

/** The tick circle and Undo: each answers with the fresh Now (view "home", with the page's time). */
export const actions = formActions(HOME_SAVES, 'home') as Actions;
