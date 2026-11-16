import { formActions } from '#lib/server/actions.js';
import { readGym } from '#lib/server/gymread.js';
import { PICK_SAVES } from '#lib/server/saves.js';
import { askedNumber, type HomePick } from '#lib/home.js';
import type { Actions, PageServerLoad } from './$types';

// Home's Pick page (deploy 99) from GET /api/v1/home/pick?min=&n=: the job picked for the time, or the open timer's job with its
// seconds left (the end is kept on the server; the page counts down in the browser and reads again when it comes back into view).
export const load: PageServerLoad = async (event) => {
  const min = askedNumber(event.url.searchParams.get('min'), 3);
  const n = askedNumber(event.url.searchParams.get('n'), 4);
  const r = await readGym<HomePick>(event, '/home/pick', 'home_pick', { min: min || undefined, n: n || undefined });
  return { pick: r.read, undo: r.undo, problem: r.problem, min, n };
};

/** The timer, Done (answered with Now: view "home"), Done next job, Not today, Done it earlier? and Undo (view "home_pick"). */
export const actions = formActions(PICK_SAVES, 'home_pick', ['home']) as Actions;
