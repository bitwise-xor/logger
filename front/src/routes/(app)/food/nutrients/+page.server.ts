import { readDoor } from '#lib/server/read.js';
import { askedDay } from '#lib/food.js';
import { askedPeriod, type Nutrients } from '#lib/nutrients.js';
import type { PageServerLoad } from './$types';

// The Food space's Nutrients tab (21.11.2026) from GET /api/v1/food/nutrients: ?day=yyyy-mm-dd (a later one is today) and
// ?days=1|7|30 (anything else is 1). Read only: no form actions.
export const load: PageServerLoad = async (event) => {
  const day = askedDay(event.url.searchParams.get('day'));
  const days = askedPeriod(event.url.searchParams.get('days'));
  const r = await readDoor<Nutrients>(event, '/food/nutrients', 'food_nutrients', { day, days: String(days) }, { notThere: 'problem' });
  return { nutrients: r.read, days, problem: r.problem };
};
