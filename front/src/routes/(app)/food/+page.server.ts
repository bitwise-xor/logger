import { redirect } from '@sveltejs/kit';
import { formActions } from '#lib/server/actions.js';
import { door } from '#lib/server/config.js';
import { FOOD_SAVES } from '#lib/server/saves.js';
import { endSession, renewSession } from '#lib/server/session.js';
import { loginHref } from '#lib/next.js';
import { problemOf } from '#lib/problems.js';
import type { Undo } from '#lib/day.js';
import { askedDay, type FoodDay } from '#lib/food.js';
import type { Actions, PageServerLoad } from './$types';

// The Food day (step E, deploy 84) from GET /api/v1/food/day: ?day=yyyy-mm-dd for an earlier day (a later one is today), and
// ?open=f<id> to open a row (a food row on Today leads here).
export const load: PageServerLoad = async ({ locals, cookies, url }) => {
  const session = locals.session;
  if (!session) redirect(303, loginHref(url.pathname + url.search));
  const day = askedDay(url.searchParams.get('day'));
  const ref = url.searchParams.get('open');
  const open = ref && /^f\d{1,9}$/.test(ref) ? ref : null;
  try {
    const { body, expiresAt } = await door.get<{ food_day: FoodDay; undo: Undo | null }>('/food/day', session, { day });
    renewSession(cookies, session, expiresAt);
    return { foodDay: body.food_day, undo: body.undo ?? null, open, problem: null };
  } catch (error) {
    const problem = problemOf(error);
    if (problem === 'signed_out') {
      endSession(cookies);
      redirect(303, loginHref(url.pathname + url.search));
    }
    return { foodDay: null, undo: null, open: null, problem };
  }
};

/** A row's change, its note, and Undo: each answers with the fresh food day of the day shown (view "food", view_day). */
export const actions = formActions(FOOD_SAVES, 'food') as Actions;
