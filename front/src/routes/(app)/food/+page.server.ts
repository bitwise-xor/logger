import { formActions } from '#lib/server/actions.js';
import { readDoor } from '#lib/server/read.js';
import { FOOD_SAVES } from '#lib/server/saves.js';
import { askedDay, type FoodDay } from '#lib/food.js';
import type { Actions, PageServerLoad } from './$types';

// The Food day (step E, deploy 84) from GET /api/v1/food/day: ?day=yyyy-mm-dd for an earlier day (a later one is today), and
// ?open=f<id> to open a row (a food row on Today leads here). A problem (step F) opens no row.
export const load: PageServerLoad = async (event) => {
  const day = askedDay(event.url.searchParams.get('day'));
  const ref = event.url.searchParams.get('open');
  const open = ref && /^f\d{1,9}$/.test(ref) ? ref : null;
  const r = await readDoor<FoodDay>(event, '/food/day', 'food_day', { day }, { notThere: 'problem' });
  return { foodDay: r.read, undo: r.undo, open: r.problem ? null : open, problem: r.problem };
};

/** A row's change, its note, and Undo: each answers with the fresh food day of the day shown (view "food", view_day). */
export const actions = formActions(FOOD_SAVES, 'food') as Actions;
