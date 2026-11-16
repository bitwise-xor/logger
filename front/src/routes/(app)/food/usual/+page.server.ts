import { redirect } from '@sveltejs/kit';
import { formActions } from '#lib/server/actions.js';
import { door } from '#lib/server/config.js';
import { USUAL_SAVES } from '#lib/server/saves.js';
import { endSession, renewSession } from '#lib/server/session.js';
import { loginHref } from '#lib/next.js';
import { problemOf } from '#lib/problems.js';
import type { Undo } from '#lib/day.js';
import type { Usual } from '#lib/usual.js';
import type { Actions, PageServerLoad } from './$types';

// The Usual meals page (deploy 87) from GET /api/v1/usual: every usual meal and drink by name, also those hidden from Today's
// chips. ?open=<meal_id> opens one (none: the list).
export const load: PageServerLoad = async ({ locals, cookies, url }) => {
  const session = locals.session;
  if (!session) redirect(303, loginHref(url.pathname + url.search));
  const asked = url.searchParams.get('open');
  const open = asked && /^\d{1,9}$/.test(asked) ? Number(asked) : null;
  try {
    const { body, expiresAt } = await door.get<{ usual: Usual[]; undo: Undo | null }>('/usual', session);
    renewSession(cookies, session, expiresAt);
    return { usual: body.usual, undo: body.undo ?? null, open, problem: null };
  } catch (error) {
    const problem = problemOf(error);
    if (problem === 'signed_out') {
      endSession(cookies);
      redirect(303, loginHref(url.pathname + url.search));
    }
    return { usual: null, undo: null, open: null, problem };
  }
};

/** A meal changed or deleted, a new one, and Undo: each answers with the whole list fresh (view "usual"). */
export const actions = formActions(USUAL_SAVES, 'usual') as Actions;
