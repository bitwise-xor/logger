import { redirect } from '@sveltejs/kit';
import { door } from '#lib/server/config.js';
import { endSession, renewSession } from '#lib/server/session.js';
import { loginHref } from '#lib/next.js';
import { problemOf } from '#lib/problems.js';
import type { FoodNotes } from '#lib/foodnotes.js';
import type { PageServerLoad } from './$types';

// The Food space's Notes tab (21.11.2026) from GET /api/v1/food/notes: every meal note and food note of the last 90 days. Read only:
// a note is added or changed on the Day tab.
export const load: PageServerLoad = async ({ locals, cookies, url }) => {
  const session = locals.session;
  if (!session) redirect(303, loginHref(url.pathname + url.search));
  try {
    const { body, expiresAt } = await door.get<{ food_notes: FoodNotes }>('/food/notes', session);
    renewSession(cookies, session, expiresAt);
    return { notes: body.food_notes, problem: null };
  } catch (error) {
    const problem = problemOf(error);
    if (problem === 'signed_out') {
      endSession(cookies);
      redirect(303, loginHref(url.pathname + url.search));
    }
    return { notes: null, problem };
  }
};
