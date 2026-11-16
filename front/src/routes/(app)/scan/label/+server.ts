import { door } from '#lib/server/config.js';
import { answer, failure, photoForm, signedOut } from '#lib/server/scan.js';
import { renewSession } from '#lib/server/session.js';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/**
 * The scan sheet (deploy 90): one to three photos of one package (made smaller in the browser), read together by the AI at the
 * door (POST /api/v1/food/label, multipart, up to 60 s). Nothing is saved and no photo is kept: they pass through in memory.
 * A body over BODY_SIZE_LIMIT (compose.yaml, 13 MB) is refused by the server before it gets here (413).
 */
export const POST: RequestHandler = async ({ locals, cookies, request }) => {
  const session = locals.session;
  if (!session) return signedOut();
  let got: FormData;
  try {
    got = await request.formData();
  } catch (error) {
    // over BODY_SIZE_LIMIT: SvelteKit's body stream fails with a 413 error (its status, or its words)
    const e = error as { status?: number; message?: string; cause?: { status?: number } } | null;
    const big = e?.status === 413 || e?.cause?.status === 413 || /limit/i.test(e?.message ?? '');
    return json(
      big
        ? { error: 'too_large', message: 'The photos are too large together. Remove one, or take them again.' }
        : { error: 'bad_request', message: 'Send the photos as a form, in the field photo.' },
      { status: big ? 413 : 400 },
    );
  }
  const checked = photoForm(got);
  if ('message' in checked) return json({ error: checked.status === 413 ? 'too_large' : 'bad_request', message: checked.message }, { status: checked.status });
  try {
    const { body, expiresAt } = await door.postForm<Record<string, unknown>>('/food/label', session, checked.form, 60_000);
    renewSession(cookies, session, expiresAt);
    const { v: _v, ...rest } = body;
    return answer(rest);
  } catch (error) {
    return failure(error);
  }
};
