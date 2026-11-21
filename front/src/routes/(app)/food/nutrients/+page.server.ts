import { redirect } from '@sveltejs/kit';
import { door } from '#lib/server/config.js';
import { endSession, renewSession } from '#lib/server/session.js';
import { loginHref } from '#lib/next.js';
import { problemOf } from '#lib/problems.js';
import { askedDay } from '#lib/food.js';
import { askedPeriod, type Nutrients } from '#lib/nutrients.js';
import type { PageServerLoad } from './$types';

// The Food space's Nutrients tab (21.11.2026) from GET /api/v1/food/nutrients: ?day=yyyy-mm-dd (a later one is today) and
// ?days=1|7|30 (anything else is 1). Read only: no form actions.
export const load: PageServerLoad = async ({ locals, cookies, url }) => {
  const session = locals.session;
  if (!session) redirect(303, loginHref(url.pathname + url.search));
  const day = askedDay(url.searchParams.get('day'));
  const days = askedPeriod(url.searchParams.get('days'));
  try {
    const { body, expiresAt } = await door.get<{ food_nutrients: Nutrients }>('/food/nutrients', session, { day, days: String(days) });
    renewSession(cookies, session, expiresAt);
    return { nutrients: body.food_nutrients, days, problem: null };
  } catch (error) {
    const problem = problemOf(error);
    if (problem === 'signed_out') {
      endSession(cookies);
      redirect(303, loginHref(url.pathname + url.search));
    }
    return { nutrients: null, days, problem };
  }
};
