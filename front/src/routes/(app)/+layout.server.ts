import { redirect } from '@sveltejs/kit';
import { appUrl, door } from '#lib/server/config.js';
import { endSession, renewSession } from '#lib/server/session.js';
import { loginHref } from '#lib/next.js';
import { problemOf } from '#lib/problems.js';
import type { LayoutServerLoad } from './$types';

/**
 * Every signed-in page: the session is checked with the door, and its cookie renewed from X-Session-Expires. Signed out (elsewhere,
 * or the session ended): to the sign-in page, which comes back here afterwards (`next`). The door off or the core down (step F):
 * the cookie stays, and the page itself says what is wrong (its own read fails the same way), so nothing is said twice.
 */
export const load: LayoutServerLoad = async ({ locals, cookies, url }) => {
  const session = locals.session;
  if (!session) redirect(303, loginHref(url.pathname + url.search));
  try {
    const { expiresAt } = await door.get('/session', session);
    renewSession(cookies, session, expiresAt);
  } catch (error) {
    if (problemOf(error) === 'signed_out') {
      endSession(cookies);
      redirect(303, loginHref(url.pathname + url.search));
    }
  }
  return { appUrl };
};
