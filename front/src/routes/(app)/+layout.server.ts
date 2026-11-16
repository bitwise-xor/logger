import { redirect } from '@sveltejs/kit';
import { appUrl, door } from '#lib/server/config.js';
import { DoorError } from '#lib/server/door.js';
import { endSession, renewSession } from '#lib/server/session.js';
import type { LayoutServerLoad } from './$types';

/** Every signed-in page: the session is checked with the door, and its cookie renewed from X-Session-Expires. */
export const load: LayoutServerLoad = async ({ locals, cookies }) => {
  const session = locals.session;
  if (!session) redirect(303, '/login');
  try {
    const { expiresAt } = await door.get('/session', session);
    renewSession(cookies, session, expiresAt);
    return { appUrl, problem: null };
  } catch (error) {
    // Signed out (elsewhere, or the session ended), or the door switched off: back to the sign-in page, which says why.
    if (error instanceof DoorError && ['signed_out', 'not_found', 'door_off'].includes(error.code)) {
      endSession(cookies);
      redirect(303, '/login');
    }
    // The core is down or answers oddly: the page says so, the cookie stays.
    return { appUrl, problem: error instanceof DoorError ? error.message : 'Something went wrong.' };
  }
};
