/**
 * Sign-in and sign-out through the door (POST and DELETE /api/v1/session). The checks are the web app's own: the same
 * limit of 5 wrong tries in 15 minutes, counted together with app.'s sign-in unless this browser signed in before.
 */
import { type Door, DoorError } from './door.js';
import { type CookieJar, deviceOf, endSession, sessionOf, startSession } from './session.js';

export type SignInResult = { ok: true } | { ok: false; status: number; message: string };

interface Created {
  token: string;
  device: string;
  expires_at: string;
}

const LIMITS = { password: 200, code: 12, userAgent: 300 };

export async function signIn(
  door: Door,
  cookies: CookieJar,
  form: { password: string; code: string; userAgent: string | null },
): Promise<SignInResult> {
  const password = form.password.slice(0, LIMITS.password);
  const code = form.code.replace(/\s+/g, '').slice(0, LIMITS.code);
  if (!password || !code) return { ok: false, status: 400, message: 'Type the password and the code.' };

  const body: Record<string, unknown> = { password, code };
  const device = deviceOf(cookies);
  if (device) body.device = device;
  // The browser's user agent goes to the core only as this field, for the list under Settings > Devices.
  if (form.userAgent) body.user_agent = form.userAgent.slice(0, LIMITS.userAgent);

  try {
    const { body: made } = await door.post<Created>('/session', null, body);
    if (!startSession(cookies, made.token, made.expires_at, made.device)) {
      return { ok: false, status: 502, message: 'The logger answered in a way this page cannot read.' };
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, ...failure(error) };
  }
}

function failure(error: unknown): { status: number; message: string } {
  if (!(error instanceof DoorError)) return { status: 500, message: 'Something went wrong. Try again.' };
  switch (error.code) {
    case 'wrong_credentials':
      return { status: 401, message: 'Wrong password or code.' };
    case 'too_many_tries':
      return { status: 429, message: 'Too many wrong tries. Wait 15 minutes, or sign in at app. instead.' };
    case 'door_off':
    case 'not_found':
      return { status: 503, message: 'The new front end is not switched on yet. Use app. for now.' };
    case 'unreachable':
      return { status: 503, message: 'The logger is not answering right now. Try again in a minute.' };
    default:
      return { status: 502, message: 'The logger could not sign you in. Try again.' };
  }
}

/** Ends the session at the core (best effort: the cookie goes in any case). */
export async function signOut(door: Door, cookies: CookieJar): Promise<void> {
  const session = sessionOf(cookies);
  endSession(cookies);
  if (!session) return;
  try {
    await door.del('/session', session);
  } catch {
    // Already gone, or the core is down: the session then ends by itself.
  }
}
