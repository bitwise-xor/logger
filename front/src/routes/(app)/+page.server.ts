import { fail, redirect } from '@sveltejs/kit';
import { door } from '#lib/server/config.js';
import { DoorError } from '#lib/server/door.js';
import { runSave, SAVE_NAMES, type SaveName } from '#lib/server/saves.js';
import { endSession, renewSession } from '#lib/server/session.js';
import type { Day, SaveAnswer, Undo } from '#lib/day.js';
import type { Actions, PageServerLoad, RequestEvent } from './$types';

// Today from GET /api/v1/day (step B), with the session's Undo so the Undo bar stays after a reload (step C).
export const load: PageServerLoad = async ({ locals, cookies }) => {
  const session = locals.session;
  if (!session) redirect(303, '/login');
  try {
    const { body, expiresAt } = await door.get<{ day: Day; undo: Undo | null }>('/day', session);
    renewSession(cookies, session, expiresAt);
    return { day: body.day, undo: body.undo ?? null, problem: null };
  } catch (error) {
    if (error instanceof DoorError && ['signed_out', 'not_found', 'door_off'].includes(error.code)) {
      endSession(cookies);
      redirect(303, '/login');
    }
    // The layout already says when the core is down; this says only that the day could not be read.
    return { day: null, undo: null, problem: error instanceof DoorError ? error.message : 'Today could not be read.' };
  }
};

/**
 * Step C (deploy 80): every tap on Today is one of these form actions (src/lib/server/saves.ts says which door route each
 * calls). The page posts them with fetch (src/lib/saver.ts) and takes the answer's fresh day; a form sent without the page's
 * script ends on Today again, loaded fresh.
 */
function action(name: SaveName) {
  return async ({ request, locals, cookies }: RequestEvent) => {
    const session = locals.session;
    if (!session) return fail(401, { signedOut: true, message: 'Sign in again.' });
    const form = await request.formData();
    const viewDay = form.get('view_day');
    const r = await runSave<SaveAnswer>(door, session, name, form, typeof viewDay === 'string' ? viewDay : undefined);
    if (r.ok) {
      renewSession(cookies, session, r.expiresAt);
      return { answer: r.answer };
    }
    if (r.signedOut) endSession(cookies);
    return fail(r.status, { signedOut: r.signedOut, message: r.message });
  };
}

export const actions = Object.fromEntries(SAVE_NAMES.map((n) => [n, action(n)])) as Actions;
