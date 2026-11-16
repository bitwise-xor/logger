/**
 * The two cookies of this app, both `__Host-` (Secure, Path=/, no Domain: only logger. itself can set or read them),
 * httpOnly (no script on the page can read them) and SameSite=Lax:
 *
 * - the session cookie holds the door's session token; it ends when the session ends (`expires_at` at the sign-in, then
 *   renewed from the door's X-Session-Expires header, which moves the end once a day while the session is used);
 * - the device cookie holds the device token the door hands out at the sign-in. It marks this browser as one that signed in
 *   before, so its wrong tries count on their own (docs/API.md, Sign-in). It outlasts a sign-out.
 *
 * The core stores only hashes of both tokens.
 */

/** The part of SvelteKit's `cookies` this file uses (so the tests can pass a plain object). */
export interface CookieJar {
  get(name: string): string | undefined;
  set(name: string, value: string, options: CookieOptions): void;
  delete(name: string, options: CookieOptions): void;
}

export interface CookieOptions {
  path: '/';
  httpOnly: true;
  secure: true;
  sameSite: 'lax';
  expires?: Date;
  maxAge?: number;
}

export const SESSION_COOKIE = '__Host-logger-session';
export const DEVICE_COOKIE = '__Host-logger-device';

/** Browsers keep a cookie for 400 days at most. */
const DEVICE_SECONDS = 400 * 24 * 60 * 60;

const BASE: CookieOptions = { path: '/', httpOnly: true, secure: true, sameSite: 'lax' };

/** A token as the door hands them out: no spaces or cookie separators, sensible length. */
const TOKEN = /^[A-Za-z0-9_-]{16,200}$/;

export function sessionOf(cookies: CookieJar): string | null {
  const v = cookies.get(SESSION_COOKIE);
  return v && TOKEN.test(v) ? v : null;
}

export function deviceOf(cookies: CookieJar): string | null {
  const v = cookies.get(DEVICE_COOKIE);
  return v && TOKEN.test(v) ? v : null;
}

function when(iso: string | null | undefined, now: Date): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) || d <= now ? null : d;
}

/** After the sign-in: the session until it ends, and the device token (a new one, or the same one again). */
export function startSession(
  cookies: CookieJar,
  token: string,
  expiresAt: string,
  device: string | null,
  now = new Date(),
): boolean {
  const end = when(expiresAt, now);
  if (!TOKEN.test(token) || !end) return false;
  cookies.set(SESSION_COOKIE, token, { ...BASE, expires: end });
  if (device && TOKEN.test(device)) cookies.set(DEVICE_COOKIE, device, { ...BASE, maxAge: DEVICE_SECONDS });
  return true;
}

/** Every signed-in answer of the door carries X-Session-Expires: the cookie ends with the session. */
export function renewSession(cookies: CookieJar, token: string, expiresAt: string | null, now = new Date()): void {
  const end = when(expiresAt, now);
  if (end && TOKEN.test(token)) cookies.set(SESSION_COOKIE, token, { ...BASE, expires: end });
}

/** Signed out, or the door says the session is gone. The device cookie stays. */
export function endSession(cookies: CookieJar): void {
  cookies.delete(SESSION_COOKIE, BASE);
}
