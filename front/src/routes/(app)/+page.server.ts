import { formActions } from '#lib/server/actions.js';
import { readDoor } from '#lib/server/read.js';
import { TODAY_SAVES } from '#lib/server/saves.js';
import { askedDay } from '#lib/food.js';
import type { Day } from '#lib/day.js';
import type { Actions, PageServerLoad } from './$types';

// Today from GET /api/v1/day (step B), with the session's Undo so the Undo bar stays after a reload (step C). Web 69: ?day=yyyy-mm-dd
// asks for an earlier day (the door's ?day=; a later day is today, a day that is not a date is left out).
// The door off, the core down or another problem (step F): the page says so in plain words (src/lib/problems.ts).
export const load: PageServerLoad = async (event) => {
  const r = await readDoor<Day>(event, '/day', 'day', { day: askedDay(event.url.searchParams.get('day')) }, { notThere: 'problem' });
  return { day: r.read, undo: r.undo, problem: r.problem };
};

/**
 * Step C (deploy 80): every tap on Today is one of these form actions (src/lib/server/saves.ts says which door route each
 * calls). The page posts them with fetch (src/lib/saver.ts) and takes the answer's fresh day; a form sent without the page's
 * script ends on Today again, loaded fresh.
 */
export const actions = formActions(TODAY_SAVES, 'day') as Actions;
