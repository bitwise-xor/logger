import { readDoor } from '#lib/server/read.js';
import type { FoodNotes } from '#lib/foodnotes.js';
import type { PageServerLoad } from './$types';

// The Food space's Notes tab (21.11.2026) from GET /api/v1/food/notes: every meal note and food note of the last 90 days. Read only:
// a note is added or changed on the Day tab.
export const load: PageServerLoad = async (event) => {
  const r = await readDoor<FoodNotes>(event, '/food/notes', 'food_notes', undefined, { notThere: 'problem' });
  return { notes: r.read, problem: r.problem };
};
