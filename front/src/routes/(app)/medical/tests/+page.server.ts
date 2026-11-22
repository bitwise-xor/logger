import { readDoor } from '#lib/server/read.js';
import { testsViewOf, type Tests } from '#lib/medical.js';
import type { PageServerLoad } from './$types';

// Medical's Tests over time tab (deploy 106), read only: GET /api/v1/labs/tests?q= for the list and, with ?t=, GET /api/v1/labs/tests?q=&t=
// for that test (both at once: the door's list is empty while a test is open, and from 1100 px the list stays beside the test). A search
// with one match opens that test by itself (the door's list answer carries it). A test that is not there: no test, as app.
export const load: PageServerLoad = async (event) => {
  const view = testsViewOf(event.url.searchParams);
  const q = view.q || undefined;
  const [list, one] = await Promise.all([
    readDoor<Tests>(event, '/labs/tests', 'labs_tests', { q }),
    view.t === null ? null : readDoor<Tests>(event, '/labs/tests', 'labs_tests', { q, t: String(view.t) }),
  ]);
  // the test open: the asked one, or the one a search with a single match opened by itself
  const shown = one?.read?.test ? one.read : list.read?.test ? list.read : null;
  return {
    list: list.read,
    shown,
    view,
    undo: list.undo,
    problem: list.problem ?? (list.missing ? 'trouble' : null),
  };
};
