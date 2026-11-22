import { appUrl } from '#lib/server/config.js';
import { readDoor } from '#lib/server/read.js';
import type { LayoutServerLoad } from './$types';

/**
 * Every signed-in page: the session is checked with the door, and its cookie renewed from X-Session-Expires. Signed out (elsewhere,
 * or the session ended): to the sign-in page, which comes back here afterwards (`next`). The door off or the core down (step F):
 * the cookie stays, and the page itself says what is wrong (its own read fails the same way), so nothing is said twice: the
 * layout drops the problem readDoor hands back.
 */
export const load: LayoutServerLoad = async (event) => {
  await readDoor(event, '/session', 'session', undefined, { notThere: 'problem' });
  return { appUrl };
};
