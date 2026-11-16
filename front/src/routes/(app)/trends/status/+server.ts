import { json } from '@sveltejs/kit';
import { door } from '#lib/server/config.js';
import { DoorError } from '#lib/server/door.js';
import { renewSession } from '#lib/server/session.js';
import type { RequestHandler } from './$types';

/**
 * While a Week review is read (deploy 102): the browser asks here every 5 seconds whether it is ready (GET /api/v1/coach/status?id=,
 * as app.'s card asks /web/coach/status). Only the state comes back; the page then reads the week again. The browser never calls the
 * door itself.
 */
export const GET: RequestHandler = async ({ locals, cookies, url }) => {
  const session = locals.session;
  if (!session) return json({ error: 'signed_out' }, { status: 401 });
  const id = url.searchParams.get('id') ?? '';
  if (!/^\d{1,12}$/.test(id)) return json({ error: 'bad_request' }, { status: 400 });
  try {
    const { body, expiresAt } = await door.get<{ coaching: { id: number; state: string } }>('/coach/status', session, { id });
    renewSession(cookies, session, expiresAt);
    return json({ coaching: { id: body.coaching.id, state: body.coaching.state } }, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    const status = error instanceof DoorError ? (error.code === 'signed_out' ? 401 : error.status || 502) : 500;
    return json({ error: error instanceof DoorError ? error.code : 'server_error' }, { status });
  }
};
