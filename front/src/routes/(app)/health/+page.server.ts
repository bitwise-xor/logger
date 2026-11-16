import { redirect } from '@sveltejs/kit';
import { formActions } from '#lib/server/actions.js';
import { door } from '#lib/server/config.js';
import { HEALTH_SAVES } from '#lib/server/saves.js';
import { endSession, renewSession } from '#lib/server/session.js';
import { loginHref } from '#lib/next.js';
import { problemOf } from '#lib/problems.js';
import type { Undo } from '#lib/day.js';
import { askedDay, askedRange, type Body, type Health } from '#lib/health.js';
import type { Actions, PageServerLoad } from './$types';

// The Health page (deploy 92) from GET /api/v1/health (the days and charts) and GET /api/v1/body (the body card), both of the
// range in the address (?range=7|30|90, 30 without); ?all=1 shows every day of the range; ?measure=1 opens the body form, on the
// session of ?mday=yyyy-mm-dd (today without; Today's "Measure" and the table's Now lead here).
export const load: PageServerLoad = async ({ locals, cookies, url }) => {
  const session = locals.session;
  if (!session) redirect(303, loginHref(url.pathname + url.search));
  const q = url.searchParams;
  const range = askedRange(q.get('range'));
  const all = q.get('all') === '1';
  const measuring = q.get('measure') === '1';
  const mday = measuring ? askedDay(q.get('mday')) : undefined;
  try {
    const [h, b] = await Promise.all([
      door.get<{ health: Health; undo: Undo | null }>('/health', session, all ? { range: String(range), all: '1' } : { range: String(range) }),
      door.get<{ body: Body; undo: Undo | null }>('/body', session, mday ? { day: mday, range: String(range) } : { range: String(range) }),
    ]);
    renewSession(cookies, session, h.expiresAt ?? b.expiresAt);
    return { health: h.body.health, body: b.body.body, undo: h.body.undo ?? null, measuring, problem: null };
  } catch (error) {
    const problem = problemOf(error);
    if (problem === 'signed_out') {
      endSession(cookies);
      redirect(303, loginHref(url.pathname + url.search));
    }
    return { health: null, body: null, undo: null, measuring: false, problem };
  }
};

/** A day's row and a body session, and Undo: each answers with the fresh read the page asks for (view "health" or "body"). */
export const actions = formActions(HEALTH_SAVES, 'health', ['health', 'body']) as Actions;
