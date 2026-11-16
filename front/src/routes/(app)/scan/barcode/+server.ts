import { door } from '#lib/server/config.js';
import { answer, failure, signedOut } from '#lib/server/scan.js';
import { renewSession } from '#lib/server/session.js';
import { cleanCode, CODE_RULE } from '#lib/scan.js';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/** The scan sheet (deploy 90): the catalogue's food with this barcode (GET /api/v1/foods/barcode), or food null. */
export const GET: RequestHandler = async ({ locals, cookies, url }) => {
  const session = locals.session;
  if (!session) return signedOut();
  const code = cleanCode(url.searchParams.get('code') ?? '');
  if (!code) return json({ error: 'bad_request', message: CODE_RULE }, { status: 400 });
  try {
    const { body, expiresAt } = await door.get<{ code: string; food: unknown }>('/foods/barcode', session, { code });
    renewSession(cookies, session, expiresAt);
    return answer({ code: body.code, food: body.food });
  } catch (error) {
    return failure(error);
  }
};
