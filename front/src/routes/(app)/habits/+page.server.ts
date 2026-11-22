import { formActions } from '#lib/server/actions.js';
import { readDoor } from '#lib/server/read.js';
import { HABITS_SAVES } from '#lib/server/saves.js';
import { askedShow, type Habits } from '#lib/habits.js';
import type { Actions, PageServerLoad } from './$types';

// The Habits page (deploy 94) from GET /api/v1/habits: today's ticks, the last 30 days of each tracked habit, and "Your habits"
// (?show=tracked|untracked|retired|all, tracked without).
export const load: PageServerLoad = async (event) => {
  const show = askedShow(event.url.searchParams.get('show'));
  const r = await readDoor<Habits>(event, '/habits', 'habits', { show }, { notThere: 'problem' });
  return { habits: r.read, undo: r.undo, problem: r.problem };
};

/** Today's tick, a day of the calendar, the list's forms and Undo: each answers with the fresh read (view "habits", with the filter). */
export const actions = formActions(HABITS_SAVES, 'habits') as Actions;
