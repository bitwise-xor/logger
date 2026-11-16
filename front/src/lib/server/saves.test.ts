// Today's saves through the door client, against a faked network: which route each form action calls, the key rule, the fresh
// day asked for, and a gone session told apart from other problems.
import { describe, expect, it } from 'vitest';
import { makeDoor, type Fetch } from './door.js';
import { bodyFor, runSave, SAVE_NAMES, SAVES } from './saves.js';

const TOKEN = 'f'.repeat(40);
const SESSION = 's'.repeat(43);
const KEY = '0b7c3c4e-2f7a-4a59-9d4e-6f1f0f2b9a11';

function form(fields: Record<string, string | string[]>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) for (const x of Array.isArray(v) ? v : [v]) f.append(k, x);
  return f;
}

function net(status = 200, body: unknown = { v: 1, outcome: 'saved', head: 'Saved.', day: {} }) {
  const seen: { path: string; body: Record<string, unknown>; timeout: boolean }[] = [];
  const fetch: Fetch = async (url, init) => {
    seen.push({ path: url.pathname, body: JSON.parse(init.body as string), timeout: !!init.signal });
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json', 'X-Session-Expires': '2099-01-01T00:00:00+00:00' },
    });
  };
  return { door: makeDoor({ url: 'http://logger-v2-core:8000', token: TOKEN, fetch }), seen };
}

describe('the save bodies', () => {
  it('passes the browser key on, unchanged, so a re-sent tap saves once', () => {
    const a = bodyFor('water', form({ ml: '250', key: KEY }), undefined);
    const b = bodyFor('water', form({ ml: '250', key: KEY }), undefined);
    expect(a).toEqual({ ml: 250, key: KEY, view: 'day' });
    expect(b.key).toBe(a.key);
  });

  it('makes a new key for a form sent without one, or with an odd one', () => {
    let n = 0;
    const make = () => `server-made-key-${++n}`.padEnd(20, 'x');
    expect(bodyFor('again', form({ food_id: '7', amount: '200' }), undefined, make).key).toBe('server-made-key-1xxx');
    expect(bodyFor('again', form({ food_id: '7', amount: '200', key: 'a b' }), undefined, make).key).toBe('server-made-key-2xxx');
  });

  it('sends no key where the door takes none (answer, review, undo)', () => {
    for (const name of SAVE_NAMES.filter((x) => !SAVES[x].keyed)) {
      expect(bodyFor(name, form({ key: KEY }), undefined)).not.toHaveProperty('key');
    }
  });

  it('builds each route body from the form fields', () => {
    expect(bodyFor('habit', form({ name: 'meds', action: 'untick', ref: 'e12', key: KEY }), undefined)).toEqual({
      name: 'meds',
      action: 'untick',
      ref: 'e12',
      key: KEY,
      view: 'day',
    });
    expect(bodyFor('checkin', form({ type: 'mood', value: '4', day: '2026-01-31', key: KEY }), undefined)).toMatchObject({
      type: 'mood',
      value: '4',
      day: '2026-01-31',
    });
    expect(bodyFor('health', form({ row: 'bp_morning', v1: '118', v2: '76', key: KEY }), undefined)).toEqual({
      row: 'bp_morning',
      v1: '118',
      v2: '76',
      key: KEY,
      view: 'day',
    });
    expect(bodyFor('health', form({ row: 'weight', ref: 'm3', v1: '400', confirmed: '1', key: KEY }), undefined)).toMatchObject({
      ref: 'm3',
      confirmed: true,
    });
    expect(bodyFor('review', form({ action: 'all', refs: ['f1', 'm2', 't3'] }), undefined)).toEqual({
      action: 'all',
      refs: ['f1', 'm2', 't3'],
      view: 'day',
    });
    expect(bodyFor('review', form({ action: 'ok', ref: 'f1' }), undefined)).toEqual({ action: 'ok', ref: 'f1', view: 'day' });
    expect(bodyFor('answer', form({ question_id: 'pq1', reply: 'yes' }), undefined)).toEqual({
      question_id: 'pq1',
      reply: 'yes',
      view: 'day',
    });
    // the door wants the message's id as a number
    expect(bodyFor('held_delete', form({ id: '42', key: KEY }), undefined)).toEqual({ id: 42, key: KEY, view: 'day' });
    expect(bodyFor('undo', form({ token: 'tok' }), undefined)).toEqual({ token: 'tok', view: 'day' });
  });

  it('leaves out empty fields and asks for the day shown', () => {
    expect(bodyFor('health', form({ row: 'wake', ref: '', time: '06:10', v1: '', key: KEY }), '2026-01-31')).toEqual({
      row: 'wake',
      time: '06:10',
      key: KEY,
      view: 'day',
      view_day: '2026-01-31',
    });
    expect(bodyFor('water', form({ ml: 'lots', key: KEY }), 'not a day')).toEqual({ key: KEY, view: 'day' });
  });
});

describe('a save through the door', () => {
  it('posts to the route with the session and gives back the answer and the session end', async () => {
    const n = net();
    const r = await runSave(n.door, SESSION, 'held_retry', form({ id: '5', key: KEY }));
    expect(n.seen).toEqual([{ path: '/api/v1/held/retry', body: { id: 5, key: KEY, view: 'day' }, timeout: true }]);
    expect(r).toEqual({ ok: true, answer: { v: 1, outcome: 'saved', head: 'Saved.', day: {} }, expiresAt: '2099-01-01T00:00:00+00:00' });
  });

  it('calls each route once per tap', async () => {
    for (const name of SAVE_NAMES) {
      const n = net();
      await runSave(n.door, SESSION, name, form({ key: KEY }));
      expect(n.seen.map((s) => s.path)).toEqual([`/api/v1${SAVES[name].path}`]);
    }
  });

  it('tells a gone session apart, so the tap can be kept for after the sign-in', async () => {
    const out = await runSave(net(401, { v: 1, error: 'signed_out', message: 'Sign in first.' }).door, SESSION, 'water', form({}));
    expect(out).toEqual({ ok: false, status: 401, signedOut: true, message: 'Sign in first.' });
    const off = await runSave(net(404, { v: 1, error: 'not_found', message: 'Not found.' }).door, SESSION, 'water', form({}));
    expect(off).toMatchObject({ ok: false, signedOut: true });
  });

  it('passes other problems on as they are, not as a sign-out', async () => {
    const out = await runSave(net(500, { v: 1, error: 'server_error', message: 'Something went wrong.' }).door, SESSION, 'water', form({}));
    expect(out).toEqual({ ok: false, status: 500, signedOut: false, message: 'Something went wrong.' });
  });
});
