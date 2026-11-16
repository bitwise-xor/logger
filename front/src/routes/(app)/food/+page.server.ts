import { redirect } from '@sveltejs/kit';
import { formActions } from '#lib/server/actions.js';
import { door } from '#lib/server/config.js';
import { DoorError } from '#lib/server/door.js';
import { FOOD_SAVES } from '#lib/server/saves.js';
import { endSession, renewSession } from '#lib/server/session.js';
import type { Undo } from '#lib/day.js';
import { askedDay, type FoodDay } from '#lib/food.js';
import type { Actions, PageServerLoad } from './$types';

// The Food day (step E, deploy 84) from GET /api/v1/food/day: ?day=yyyy-mm-dd for an earlier day (a later one is today), and
// ?open=f<id> to open a row (a food row on Today leads here).
export const load: PageServerLoad = async ({ locals, cookies, url }) => {
  const session = locals.session;
  if (!session) redirect(303, '/login');
  const day = askedDay(url.searchParams.get('day'));
  const ref = url.searchParams.get('open');
  const open = ref && /^f\d{1,9}$/.test(ref) ? ref : null;
  try {
    const { body, expiresAt } = await door.get<{ food_day: FoodDay; undo: Undo | null }>('/food/day', session, { day });
    renewSession(cookies, session, expiresAt);
    return { foodDay: body.food_day, undo: body.undo ?? null, open, problem: null };
  } catch (error) {
    if (error instanceof DoorError && ['signed_out', 'not_found', 'door_off'].includes(error.code)) {
      endSession(cookies);
      redirect(303, '/login');
    }
    return { foodDay: null, undo: null, open: null, problem: error instanceof DoorError ? error.message : 'The food day could not be read.' };
  }
};

/** A row's change, its note, and Undo: each answers with the fresh food day of the day shown (view "food", view_day). */
export const actions = formActions(FOOD_SAVES, 'food') as Actions;
