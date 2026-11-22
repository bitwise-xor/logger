import { formActions } from '#lib/server/actions.js';
import { readDoor } from '#lib/server/read.js';
import { ZONES_SAVES } from '#lib/server/saves.js';
import type { Zones } from '#lib/homeparts.js';
import type { Actions, PageServerLoad } from './$types';

// Home's Zones page (deploy 100) from GET /api/v1/home/zones: the starting points, the whole-flat chores with their tiles, a card per
// zone. (readDoor is the shared read of a door page: the session renewed, a gone session to the sign-in and back, any other trouble as
// a plain message.)
export const load: PageServerLoad = async (event) => {
  const r = await readDoor<Zones>(event, '/home/zones', 'home_zones');
  return { zones: r.read, undo: r.undo, problem: r.problem };
};

/** A tick (a tile or a row), All done, a starting point's chip and Undo: each answers with the fresh Zones (view "home_zones"). */
export const actions = formActions(ZONES_SAVES, 'home_zones') as Actions;
