/**
 * The form actions of the pages that save in place (Today since step C, the Food day since step E): each runs one save through
 * the door (saves.ts) and answers with the door's answer, which brings the fresh day (Today's or the Food day's: `view`).
 */
import { fail, type RequestEvent } from '@sveltejs/kit';
import { appUrl, door } from './config.js';
import { runSave, type SaveName, type View } from './saves.js';
import { endSession, renewSession } from './session.js';

export function formAction(name: SaveName, view: View, views: View[] = []) {
  return async ({ request, locals, cookies }: RequestEvent) => {
    const session = locals.session;
    if (!session) return fail(401, { signedOut: true, message: 'Sign in again.' });
    const form = await request.formData();
    const viewDay = form.get('view_day');
    // A page with two reads (the Health page: its days and charts, or the body card) says which one the answer brings.
    const asked = form.get('view');
    const shown = views.find((v) => v === asked) ?? view;
    const r = await runSave(door, session, name, form, typeof viewDay === 'string' ? viewDay : undefined, shown, { userAgent: request.headers.get('user-agent') });
    if (r.ok) {
      renewSession(cookies, session, r.expiresAt);
      return { answer: r.answer };
    }
    if (r.signedOut) endSession(cookies);
    // The door off (step F): the bar links to app., which still works.
    // unsure (Web 65): the door got the save and did not answer in time; the browser keeps the key for the same tap.
    return fail(r.status, { signedOut: r.signedOut, message: r.message, link: r.problem === 'door_off' ? `${appUrl}/web/` : null, unsure: !!r.unsure });
  };
}

/** The form actions of a page: one per save it offers. */
export const formActions = (names: SaveName[], view: View, views: View[] = []) =>
  Object.fromEntries(names.map((n) => [n, formAction(n, view, views)]));
