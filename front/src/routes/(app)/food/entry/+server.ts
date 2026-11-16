import { json } from '@sveltejs/kit';
import { door } from '#lib/server/config.js';
import { DoorError } from '#lib/server/door.js';
import { renewSession } from '#lib/server/session.js';
import type { FoodEntry } from '#lib/food.js';
import type { RequestHandler } from './$types';

/** One entry for the Food day's open row (GET /api/v1/food/entry): its units. The browser never calls the door itself. */
export const GET: RequestHandler = async ({ locals, cookies, url }) => {
  const session = locals.session;
  if (!session) return json({ error: 'signed_out' }, { status: 401 });
  const ref = url.searchParams.get('ref') ?? '';
  if (!/^f\d{1,9}$/.test(ref)) return json({ error: 'no_entry' }, { status: 404 });
  try {
    const { body, expiresAt } = await door.get<{ entry: FoodEntry }>('/food/entry', session, { ref });
    renewSession(cookies, session, expiresAt);
    return json({ entry: body.entry }, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    const status = error instanceof DoorError ? (error.status === 404 ? 404 : error.status || 502) : 500;
    return json({ error: error instanceof DoorError ? error.code : 'server_error' }, { status });
  }
};
