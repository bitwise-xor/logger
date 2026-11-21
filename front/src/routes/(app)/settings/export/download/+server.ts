import { redirect } from '@sveltejs/kit';
import { door } from '#lib/server/config.js';
import { DoorError } from '#lib/server/door.js';
import { endSession, renewSession } from '#lib/server/session.js';
import { loginHref } from '#lib/next.js';
import { problemOf } from '#lib/problems.js';
import { downloadHeaders, EXPORT_CODE_REFUSALS, EXPORT_REFUSED_COOKIE, exportCode, refusedText } from '#lib/settings.js';
import type { RequestHandler } from './$types';

/**
 * Settings > Export's Download (deploy 111): the tab's plain form posts here (SvelteKit's origin check for form posts applies, as to
 * every form of this app), this asks the door for the ZIP (POST /api/v1/export, up to a minute) and hands its bytes through with the
 * door's Content-Type and Content-Disposition and no-store. Nothing is kept or logged here. A gone session goes to the sign-in page
 * (and back to the tab); any other trouble goes back to the tab with a short line, never a broken download.
 * Core 37 (21.11.2026): with private entries the form's authenticator code goes along; the door's refusal of the code (wrong, missing,
 * too many tries) goes back to the tab in the door's words, in a cookie read once (`?refused=1`).
 */
export const POST: RequestHandler = async ({ request, locals, cookies }) => {
  const back = '/settings/export';
  const session = locals.session;
  if (!session) redirect(303, loginHref(back));
  const form = await request.formData().catch(() => null);
  const priv = form?.get('private') === '1';
  let file;
  try {
    file = await door.postFile('/export', session, priv ? { private: true, code: exportCode(form?.get('code')) } : { private: false });
  } catch (error) {
    if (problemOf(error) === 'signed_out') {
      endSession(cookies);
      redirect(303, loginHref(back));
    }
    if (error instanceof DoorError && EXPORT_CODE_REFUSALS.has(error.code)) {
      const words = refusedText(error.message) ?? 'The code was not accepted. Nothing was exported.';
      cookies.set(EXPORT_REFUSED_COOKIE, words, { path: '/', httpOnly: true, secure: true, sameSite: 'strict', maxAge: 120 });
      redirect(303, `${back}?refused=1`);
    }
    redirect(303, `${back}?failed=1`);
  }
  const headers = downloadHeaders(file.contentType, file.disposition);
  if (!headers) redirect(303, `${back}?failed=1`);
  renewSession(cookies, session, file.expiresAt);
  return new Response(file.bytes, { status: 200, headers });
};
