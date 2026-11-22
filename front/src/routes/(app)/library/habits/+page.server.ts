import { formActions } from '#lib/server/actions.js';
import { readDoor } from '#lib/server/read.js';
import { LIBRARY_HABITS_SAVES } from '#lib/server/saves.js';
import type { Undo } from '#lib/day.js';
import { askedShow, type Habits } from '#lib/habits.js';
import type { Actions, PageServerLoad } from './$types';

// Library's Habits tab (deploy 105): the Habits page's "Your habits" (?show=tracked|untracked|retired|all, tracked without) from the same
// GET /api/v1/habits; readDoor is the shared read of a door page (the session renewed, a gone session to the sign-in and back here).
export const load: PageServerLoad = async (event) => {
  const show = askedShow(event.url.searchParams.get('show'));
  const r = await readDoor<Habits>(event, '/habits', 'habits', { show });
  return { habits: r.read, undo: r.undo as Undo | null, problem: r.problem ?? (r.missing ? 'trouble' : null) };
};

/** The list's forms (Track, Edit, Retire or Bring back, Delete, + New habit): habits_manage, as on the Habits page (view "habits"). */
export const actions = formActions(LIBRARY_HABITS_SAVES, 'habits') as Actions;
