// The one read of the door for a page's load (web item 72): the session renewed, a gone session to the sign-in page and back, any
// other trouble as a plain problem kind, and the pages' differences as options (a 404 or 400 as "missing" or as trouble, an answer
// without its read, several reads each on its own or together).
import { isRedirect } from '@sveltejs/kit';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DoorError } from './door.js';

type Got = { body: Record<string, unknown>; expiresAt: string | null };
const answers = new Map<string, () => Promise<Got>>();
vi.mock('./config.js', () => ({
  door: {
    get: (path: string) => (answers.get(path) ?? (() => Promise.reject(new Error(`no answer for ${path}`))))(),
  },
}));
const { readDoor, readDoors, readSettings } = await import('./read.js');

const SESSION = 's'.repeat(43);
const LATER = '2099-01-01T00:00:00+00:00';
const ok = (body: Record<string, unknown>, expiresAt: string | null = LATER) => () => Promise.resolve({ body, expiresAt });
const fails = (status: number, code: string) => () => Promise.reject(new DoorError(status, code, 'no'));

function event(session: string | null = SESSION, path = '/food?day=2026-11-20') {
  const set = vi.fn();
  const del = vi.fn();
  return { locals: { session }, cookies: { set, delete: del } as never, url: new URL(`http://localhost${path}`), set, del };
}

async function redirected(p: Promise<unknown>): Promise<string> {
  try {
    await p;
  } catch (e) {
    if (isRedirect(e)) return e.location;
    throw e;
  }
  throw new Error('no redirect');
}

beforeEach(() => answers.clear());

describe('readDoor', () => {
  it('reads, renews the session and passes the Undo on', async () => {
    answers.set('/day', ok({ day: { date: 'x' }, undo: { token: 't' } }));
    const e = event();
    expect(await readDoor(e, '/day', 'day')).toEqual({ read: { date: 'x' }, undo: { token: 't' }, problem: null });
    expect(e.set).toHaveBeenCalledOnce();
  });

  it('sends a page without a session, and a gone session, to the sign-in page and back', async () => {
    expect(await redirected(readDoor(event(null), '/day', 'day'))).toBe('/login?next=%2Ffood%3Fday%3D2026-11-20');
    answers.set('/day', fails(401, 'signed_out'));
    const e = event();
    expect(await redirected(readDoor(e, '/day', 'day'))).toBe('/login?next=%2Ffood%3Fday%3D2026-11-20');
    expect(e.del).toHaveBeenCalledOnce();
  });

  it('hands any other trouble to the page as its kind, the session kept', async () => {
    answers.set('/day', fails(0, 'unreachable'));
    const e = event();
    expect(await readDoor(e, '/day', 'day')).toEqual({ read: null, undo: null, problem: 'core_down' });
    answers.set('/day', fails(404, 'not_found'));
    expect(await readDoor(e, '/day', 'day', undefined, { notThere: 'problem' })).toEqual({ read: null, undo: null, problem: 'door_off' });
    expect(e.set).not.toHaveBeenCalled();
    expect(e.del).not.toHaveBeenCalled();
  });

  it("a 404 no_entry or a 400 is missing by default, and trouble with notThere: 'problem'", async () => {
    for (const [status, code] of [
      [404, 'no_entry'],
      [400, 'bad_request'],
    ] as const) {
      answers.set('/home/chore', fails(status, code));
      expect(await readDoor(event(), '/home/chore', 'home_chore')).toEqual({ read: null, undo: null, problem: null, missing: true });
      expect(await readDoor(event(), '/home/chore', 'home_chore', undefined, { notThere: 'problem' })).toEqual({ read: null, undo: null, problem: 'trouble' });
    }
  });

  it('an answer without its read is null, or trouble when required', async () => {
    answers.set('/insights', ok({}));
    expect(await readDoor(event(), '/insights', 'insights')).toEqual({ read: null, undo: null, problem: null });
    expect(await readDoor(event(), '/insights', 'insights', undefined, { required: true })).toEqual({ read: null, undo: null, problem: 'trouble' });
  });
});

describe('readDoors', () => {
  it('each on its own: one failing leaves the others, renewed from the first that answered', async () => {
    answers.set('/a', fails(0, 'no_answer'));
    answers.set('/b', ok({ b: 1 }, null));
    answers.set('/c', ok({ c: 2 }));
    const e = event();
    const got = await readDoors(e, [{ path: '/a', key: 'a' }, { path: '/b', key: 'b' }, { path: '/c', key: 'c' }], { notThere: 'problem', required: true });
    expect(got.map((g) => [g.read, g.problem])).toEqual([
      [null, 'core_down'],
      [1, null],
      [2, null],
    ]);
    // the first that answered had no end time: nothing renewed (as readEach did)
    expect(e.set).not.toHaveBeenCalled();
  });

  it('each on its own: a gone session on any of them goes to the sign-in page', async () => {
    answers.set('/a', ok({ a: 1 }));
    answers.set('/b', fails(401, 'signed_out'));
    const e = event();
    await redirected(readDoors(e, [{ path: '/a', key: 'a' }, { path: '/b', key: 'b' }]));
    expect(e.del).toHaveBeenCalledOnce();
  });

  it('together: one failing fails all with its kind; renewed from the first answer with an end time', async () => {
    answers.set('/health', ok({ health: { h: 1 }, undo: null }, null));
    answers.set('/body', fails(503, 'server_error'));
    expect((await readDoors(event(), [{ path: '/health', key: 'health' }, { path: '/body', key: 'body' }], { together: true, notThere: 'problem' })).map((g) => g.problem)).toEqual([
      'trouble',
      'trouble',
    ]);
    answers.set('/body', ok({ body: { b: 2 } }));
    const e = event();
    const [h, b] = await readDoors(e, [{ path: '/health', key: 'health' }, { path: '/body', key: 'body' }], { together: true, notThere: 'problem' });
    expect([h!.read, b!.read, h!.problem, b!.problem]).toEqual([{ h: 1 }, { b: 2 }, null, null]);
    expect(e.set).toHaveBeenCalledOnce();
  });
});

describe('readSettings', () => {
  it('gives the tab its read and problem only; a 404, a 400 or no tab is trouble', async () => {
    answers.set('/settings/body', ok({ settings_body: { x: 1 }, undo: null }));
    expect(await readSettings(event(), 'body')).toEqual({ read: { x: 1 }, problem: null });
    answers.set('/settings/body', ok({}));
    expect(await readSettings(event(), 'body')).toEqual({ read: null, problem: 'trouble' });
    answers.set('/settings/body', fails(404, 'no_entry'));
    expect(await readSettings(event(), 'body')).toEqual({ read: null, problem: 'trouble' });
  });
});
