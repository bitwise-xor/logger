// Sign-in, sign-out and the two cookies, with a faked door and a plain cookie jar.
import { describe, expect, it } from 'vitest';
import { type Fetch, makeDoor } from './door.js';
import {
  type CookieJar,
  type CookieOptions,
  DEVICE_COOKIE,
  renewSession,
  SESSION_COOKIE,
  sessionOf,
} from './session.js';
import { signIn, signOut } from './signin.js';

const TOKEN = 'f'.repeat(40);
const SESSION = 'S'.repeat(43);
const DEVICE = 'D'.repeat(43);
const NOW = new Date('2026-11-16T10:00:00Z');
const LATER = '2026-12-16T10:00:00+00:00';

function jar(start: Record<string, string> = {}) {
  const values = new Map(Object.entries(start));
  const sets: { name: string; value: string; options: CookieOptions }[] = [];
  const deletes: string[] = [];
  const cookies: CookieJar = {
    get: (name) => values.get(name),
    set: (name, value, options) => {
      values.set(name, value);
      sets.push({ name, value, options });
    },
    delete: (name) => {
      values.delete(name);
      deletes.push(name);
    },
  };
  return { cookies, values, sets, deletes };
}

function door(status: number, body: unknown) {
  const bodies: Record<string, unknown>[] = [];
  const methods: string[] = [];
  const fetch: Fetch = async (_url, init) => {
    methods.push(init.method ?? '');
    if (init.body) bodies.push(JSON.parse(init.body as string) as Record<string, unknown>);
    return new Response(JSON.stringify(body), { status });
  };
  return { door: makeDoor({ url: 'http://logger-v2-core:8000', token: TOKEN, fetch }), bodies, methods };
}

const FORM = { password: 'pw', code: '123 456', userAgent: 'Test browser' };

describe('sign-in', () => {
  it('sets two __Host- cookies, httpOnly and Secure', async () => {
    const d = door(201, { v: 1, token: SESSION, device: DEVICE, expires_at: '2099-01-01T00:00:00+00:00' });
    const j = jar();
    expect(await signIn(d.door, j.cookies, FORM)).toEqual({ ok: true });
    expect(j.sets.map((s) => s.name)).toEqual([SESSION_COOKIE, DEVICE_COOKIE]);
    for (const s of j.sets) {
      expect(s.name.startsWith('__Host-')).toBe(true);
      expect(s.options).toMatchObject({ path: '/', httpOnly: true, secure: true, sameSite: 'lax' });
    }
    expect(j.sets[0]!.options.expires?.toISOString()).toBe('2099-01-01T00:00:00.000Z');
    expect(j.sets[1]!.options.maxAge).toBe(400 * 24 * 60 * 60);
    expect(j.values.get(SESSION_COOKIE)).toBe(SESSION);
  });

  it('sends the device it got last time, the user agent as a field, and the code without spaces', async () => {
    const d = door(201, { v: 1, token: SESSION, device: DEVICE, expires_at: '2099-01-01T00:00:00+00:00' });
    await signIn(d.door, jar({ [DEVICE_COOKIE]: DEVICE }).cookies, FORM);
    expect(d.bodies[0]).toEqual({ password: 'pw', code: '123456', device: DEVICE, user_agent: 'Test browser' });
  });

  it('asks for both fields before calling the door', async () => {
    const d = door(201, {});
    expect(await signIn(d.door, jar().cookies, { ...FORM, code: ' ' })).toMatchObject({ ok: false, status: 400 });
    expect(d.methods).toEqual([]);
  });

  it.each([
    [401, 'wrong_credentials', 'Wrong password or code.'],
    [429, 'too_many_tries', 'Too many wrong tries'],
    [404, 'not_found', 'not switched on yet'],
  ])('a %i %s says so in plain words and sets no cookie', async (status, error, words) => {
    const d = door(status, { v: 1, error, message: 'x' });
    const j = jar();
    const out = await signIn(d.door, j.cookies, FORM);
    expect(out.ok).toBe(false);
    expect(out.ok === false && out.message).toContain(words);
    expect(j.sets).toEqual([]);
  });

  it('sets no cookie from an answer it cannot use', async () => {
    const d = door(201, { v: 1, token: 'short', device: DEVICE, expires_at: LATER });
    const j = jar();
    expect((await signIn(d.door, j.cookies, FORM)).ok).toBe(false);
    expect(j.sets).toEqual([]);
  });
});

describe('the session cookie', () => {
  it('is renewed from X-Session-Expires', () => {
    const j = jar({ [SESSION_COOKIE]: SESSION });
    renewSession(j.cookies, SESSION, LATER, NOW);
    expect(j.sets).toHaveLength(1);
    expect(j.sets[0]!.options.expires?.toISOString()).toBe('2026-12-16T10:00:00.000Z');
  });

  it.each([null, '', 'tomorrow', '2026-11-16T09:00:00Z'])('is left alone for an end of %s', (end) => {
    const j = jar({ [SESSION_COOKIE]: SESSION });
    renewSession(j.cookies, SESSION, end, NOW);
    expect(j.sets).toEqual([]);
  });

  it('is read only when it looks like a token', () => {
    expect(sessionOf(jar({ [SESSION_COOKIE]: SESSION }).cookies)).toBe(SESSION);
    expect(sessionOf(jar({ [SESSION_COOKIE]: 'a b; c' }).cookies)).toBeNull();
    expect(sessionOf(jar().cookies)).toBeNull();
  });
});

describe('sign-out', () => {
  it('ends the session at the core, drops its cookie and keeps the device', async () => {
    const d = door(200, { v: 1, outcome: 'signed_out' });
    const j = jar({ [SESSION_COOKIE]: SESSION, [DEVICE_COOKIE]: DEVICE });
    await signOut(d.door, j.cookies);
    expect(d.methods).toEqual(['DELETE']);
    expect(j.deletes).toEqual([SESSION_COOKIE]);
    expect(j.values.get(DEVICE_COOKIE)).toBe(DEVICE);
  });

  it('drops the cookie even when the core is down', async () => {
    const fetch: Fetch = async () => {
      throw new TypeError('fetch failed');
    };
    const j = jar({ [SESSION_COOKIE]: SESSION });
    await signOut(makeDoor({ url: 'http://logger-v2-core:8000', token: TOKEN, fetch }), j.cookies);
    expect(j.deletes).toEqual([SESSION_COOKIE]);
  });
});
