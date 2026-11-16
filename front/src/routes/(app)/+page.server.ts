import { redirect } from '@sveltejs/kit';
import { door } from '#lib/server/config.js';
import { DoorError } from '#lib/server/door.js';
import { endSession, renewSession } from '#lib/server/session.js';
import type { Day, Undo } from '#lib/day.js';
import type { PageServerLoad } from './$types';

// Step B (deploy 79): Today, read-only, from GET /api/v1/day. The saves come in step C.
export const load: PageServerLoad = async ({ locals, cookies }) => {
  const session = locals.session;
  if (!session) redirect(303, '/login');
  try {
    const { body, expiresAt } = await door.get<{ day: Day; undo: Undo | null }>('/day', session);
    renewSession(cookies, session, expiresAt);
    return { day: body.day, problem: null };
  } catch (error) {
    if (error instanceof DoorError && ['signed_out', 'not_found', 'door_off'].includes(error.code)) {
      endSession(cookies);
      redirect(303, '/login');
    }
    // The layout already says when the core is down; this says only that the day could not be read.
    return { day: null, problem: error instanceof DoorError ? error.message : 'Today could not be read.' };
  }
};
