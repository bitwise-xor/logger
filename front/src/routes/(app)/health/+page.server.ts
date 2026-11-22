import { formActions } from '#lib/server/actions.js';
import { readDoors } from '#lib/server/read.js';
import { HEALTH_SAVES } from '#lib/server/saves.js';
import { askedDay, askedRange, type Body, type Health } from '#lib/health.js';
import type { Actions, PageServerLoad } from './$types';

// The Health page (deploy 92) from GET /api/v1/health (the days and charts) and GET /api/v1/body (the body card), both of the
// range in the address (?range=7|30|90, 30 without); ?all=1 shows every day of the range; ?measure=1 opens the body form, on the
// session of ?mday=yyyy-mm-dd (today without; Today's "Measure" and the table's Now lead here). The two are read together: one
// failing is the whole page's problem, and the body form stays closed.
export const load: PageServerLoad = async (event) => {
  const q = event.url.searchParams;
  const range = askedRange(q.get('range'));
  const all = q.get('all') === '1';
  const measuring = q.get('measure') === '1';
  const mday = measuring ? askedDay(q.get('mday')) : undefined;
  const [h, b] = await readDoors(
    event,
    [
      { path: '/health', key: 'health', query: all ? { range: String(range), all: '1' } : { range: String(range) } },
      { path: '/body', key: 'body', query: mday ? { day: mday, range: String(range) } : { range: String(range) } },
    ],
    { together: true, notThere: 'problem' },
  );
  const problem = h!.problem ?? b!.problem;
  return { health: h!.read as Health | null, body: b!.read as Body | null, undo: h!.undo, measuring: problem ? false : measuring, problem };
};

/** A day's row and a body session, and Undo: each answers with the fresh read the page asks for (view "health" or "body"). */
export const actions = formActions(HEALTH_SAVES, 'health', ['health', 'body']) as Actions;
