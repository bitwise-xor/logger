import { json } from '@sveltejs/kit';
import { door } from '#lib/server/config.js';
import { DoorError } from '#lib/server/door.js';
import { renewSession } from '#lib/server/session.js';
import type { SuggestFood } from '#lib/suggest.js';
import type { RequestHandler } from './$types';

/**
 * The foods for the logging box's suggestions (deploy 117; GET /api/v1/foods/suggest): every active food with its words, the
 * amount eaten last, how often and when. Asked once, on the box's first focus. The browser never calls the door itself.
 */
export const GET: RequestHandler = async ({ locals, cookies }) => {
  const session = locals.session;
  if (!session) return json({ error: 'signed_out' }, { status: 401 });
  try {
    const { body, expiresAt } = await door.get<{ foods: SuggestFood[] }>('/foods/suggest', session);
    renewSession(cookies, session, expiresAt);
    return json({ foods: Array.isArray(body.foods) ? body.foods : [] }, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    const status = error instanceof DoorError ? error.status || 502 : 500;
    return json({ error: error instanceof DoorError ? error.code : 'server_error' }, { status });
  }
};
