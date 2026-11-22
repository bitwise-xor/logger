import { formActions } from '#lib/server/actions.js';
import { readDoor } from '#lib/server/read.js';
import { CATALOGUE_SAVES } from '#lib/server/saves.js';
import { GONE, viewOf, type Catalogue, type Item } from '#lib/catalogue.js';
import type { Actions, PageServerLoad } from './$types';

// Library's Foods tab (deploy 105) from GET /api/v1/food/catalogue?q=&f=&s= and, with ?food=, GET /api/v1/food/item?id= (both at once).
// A filter or order the door does not know falls back to its default (so the door's 400 is never asked for); a food that is not there
// (the door's 404) says so in place of its box, and the list still shows. readDoor: the session renewed, a gone session to the
// sign-in and back here, any other trouble as a plain message (ProblemCard).
export const load: PageServerLoad = async (event) => {
  const view = viewOf(event.url.searchParams);
  const [list, box] = await Promise.all([
    readDoor<Catalogue>(event, '/food/catalogue', 'catalogue', { q: view.q || undefined, f: view.f === 'all' ? undefined : view.f, s: view.s === 'eaten' ? undefined : view.s }),
    view.food === null ? null : readDoor<Item>(event, '/food/item', 'food_item', { id: `N${view.food}` }),
  ]);
  return {
    catalogue: list.read,
    item: box?.read ?? null,
    gone: box?.missing ? GONE : null,
    view,
    undo: list.undo,
    problem: list.problem ?? (list.missing ? 'trouble' : null),
  };
};

/** The Catalogue's six forms, the look-up and its answer: each answers with the fresh Catalogue and box (view "catalogue"). */
export const actions = formActions(CATALOGUE_SAVES, 'catalogue') as Actions;
