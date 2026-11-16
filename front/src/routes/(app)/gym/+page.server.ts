import { redirect } from '@sveltejs/kit';
import { formActions } from '#lib/server/actions.js';
import { door } from '#lib/server/config.js';
import { GYM_SAVES } from '#lib/server/saves.js';
import { endSession, renewSession } from '#lib/server/session.js';
import { loginHref } from '#lib/next.js';
import { problemOf } from '#lib/problems.js';
import type { Undo } from '#lib/day.js';
import type { Workout } from '#lib/gym.js';
import type { Actions, PageServerLoad } from './$types';

// The Gym's Workout page (deploy 96) from GET /api/v1/gym: today's day of the split, the exercises with their circles, "This
// week's split" and the last 4 weeks.
export const load: PageServerLoad = async ({ locals, cookies, url }) => {
  const session = locals.session;
  if (!session) redirect(303, loginHref(url.pathname + url.search));
  try {
    const { body, expiresAt } = await door.get<{ gym: Workout; undo: Undo | null }>('/gym', session);
    renewSession(cookies, session, expiresAt);
    return { workout: body.gym, undo: body.undo ?? null, problem: null };
  } catch (error) {
    const problem = problemOf(error);
    if (problem === 'signed_out') {
      endSession(cookies);
      redirect(303, loginHref(url.pathname + url.search));
    }
    return { workout: null, undo: null, problem };
  }
};

/** A tick, a remove, the day pick, + Add exercise and Undo: each answers with the fresh Workout (view "gym"). */
export const actions = formActions(GYM_SAVES, 'gym') as Actions;
