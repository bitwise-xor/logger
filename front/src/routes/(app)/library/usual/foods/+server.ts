import { json } from '@sveltejs/kit';
import { door } from '#lib/server/config.js';
import { DoorError } from '#lib/server/door.js';
import { renewSession } from '#lib/server/session.js';
import type { FoodHit } from '#lib/usual.js';
import type { RequestHandler } from './$types';

/** Foods of the catalogue for the words (GET /api/v1/foods?q=), to add to a usual meal or swap one. The browser never calls the door. */
export const GET: RequestHandler = async ({ locals, cookies, url }) => {
  const session = locals.session;
  if (!session) return json({ error: 'signed_out' }, { status: 401 });
  const q = (url.searchParams.get('q') ?? '').trim().slice(0, 100);
  try {
    const { body, expiresAt } = await door.get<{ foods: FoodHit[] }>('/foods', session, { q });
    renewSession(cookies, session, expiresAt);
    return json({ foods: body.foods }, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    const status = error instanceof DoorError ? error.status || 502 : 500;
    return json({ error: error instanceof DoorError ? error.code : 'server_error' }, { status });
  }
};
