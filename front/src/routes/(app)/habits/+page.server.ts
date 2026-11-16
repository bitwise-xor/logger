import { redirect } from '@sveltejs/kit';
import { formActions } from '#lib/server/actions.js';
import { door } from '#lib/server/config.js';
import { HABITS_SAVES } from '#lib/server/saves.js';
import { endSession, renewSession } from '#lib/server/session.js';
import { loginHref } from '#lib/next.js';
import { problemOf } from '#lib/problems.js';
import type { Undo } from '#lib/day.js';
import { askedShow, type Habits } from '#lib/habits.js';
import type { Actions, PageServerLoad } from './$types';

// The Habits page (deploy 94) from GET /api/v1/habits: today's ticks, the last 30 days of each tracked habit, and "Your habits"
// (?show=tracked|untracked|retired|all, tracked without).
export const load: PageServerLoad = async ({ locals, cookies, url }) => {
  const session = locals.session;
  if (!session) redirect(303, loginHref(url.pathname + url.search));
  const show = askedShow(url.searchParams.get('show'));
  try {
    const { body, expiresAt } = await door.get<{ habits: Habits; undo: Undo | null }>('/habits', session, { show });
    renewSession(cookies, session, expiresAt);
    return { habits: body.habits, undo: body.undo ?? null, problem: null };
  } catch (error) {
    const problem = problemOf(error);
    if (problem === 'signed_out') {
      endSession(cookies);
      redirect(303, loginHref(url.pathname + url.search));
    }
    return { habits: null, undo: null, problem };
  }
};

/** Today's tick, a day of the calendar, the list's forms and Undo: each answers with the fresh read (view "habits", with the filter). */
export const actions = formActions(HABITS_SAVES, 'habits') as Actions;
