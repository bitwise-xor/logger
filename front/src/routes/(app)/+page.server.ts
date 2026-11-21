import { redirect } from '@sveltejs/kit';
import { formActions } from '#lib/server/actions.js';
import { door } from '#lib/server/config.js';
import { TODAY_SAVES } from '#lib/server/saves.js';
import { endSession, renewSession } from '#lib/server/session.js';
import { loginHref } from '#lib/next.js';
import { problemOf } from '#lib/problems.js';
import { askedDay } from '#lib/food.js';
import type { Day, Undo } from '#lib/day.js';
import type { Actions, PageServerLoad } from './$types';

// Today from GET /api/v1/day (step B), with the session's Undo so the Undo bar stays after a reload (step C). Web 69: ?day=yyyy-mm-dd
// asks for an earlier day (the door's ?day=; a later day is today, a day that is not a date is left out).
export const load: PageServerLoad = async ({ locals, cookies, url }) => {
  const session = locals.session;
  if (!session) redirect(303, loginHref(url.pathname + url.search));
  try {
    const { body, expiresAt } = await door.get<{ day: Day; undo: Undo | null }>('/day', session, { day: askedDay(url.searchParams.get('day')) });
    renewSession(cookies, session, expiresAt);
    return { day: body.day, undo: body.undo ?? null, problem: null };
  } catch (error) {
    const problem = problemOf(error);
    if (problem === 'signed_out') {
      endSession(cookies);
      redirect(303, loginHref(url.pathname + url.search));
    }
    // The door off, the core down or another problem (step F): the page says so in plain words (src/lib/problems.ts).
    return { day: null, undo: null, problem };
  }
};

/**
 * Step C (deploy 80): every tap on Today is one of these form actions (src/lib/server/saves.ts says which door route each
 * calls). The page posts them with fetch (src/lib/saver.ts) and takes the answer's fresh day; a form sent without the page's
 * script ends on Today again, loaded fresh.
 */
export const actions = formActions(TODAY_SAVES, 'day') as Actions;
