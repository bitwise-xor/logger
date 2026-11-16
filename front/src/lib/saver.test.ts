// Saving in place in the browser, against a faked network: the key rule, newest answer wins, and the re-send after a sign-in.
import { describe, expect, it } from 'vitest';
import { RESEND_ITEM, RESEND_MS, Saver, type ActionResult } from './saver.js';

interface Call {
  url: string;
  fields: Record<string, string[]>;
  headers: Record<string, string>;
  answer: (r: ActionResult) => void;
}

/** A network whose answers the test hands out, in any order. deserialize is the identity on JSON. */
function fakeNet() {
  const calls: Call[] = [];
  const fetch = (url: string, init: RequestInit) =>
    new Promise<Response>((resolve) => {
      const fields: Record<string, string[]> = {};
      (init.body as FormData).forEach((v, k) => (fields[k] ??= []).push(String(v)));
      calls.push({
        url,
        fields,
        headers: init.headers as Record<string, string>,
        answer: (r) => resolve(new Response(JSON.stringify(r))),
      });
    });
  return { calls, fetch, deserialize: (t: string) => JSON.parse(t) as ActionResult };
}

function memory() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
    m,
  };
}

const ok = (head: string): ActionResult => ({ type: 'success', status: 200, data: { answer: { head } } });
const tick = () => new Promise((r) => setTimeout(r, 0));

describe('the saver', () => {
  it("posts the tap to the page's form action, as SvelteKit's own forms do", async () => {
    const n = fakeNet();
    const s = new Saver({ ...n, storage: null, newKey: () => 'k1' });
    const p = s.send('water', { ml: '250' });
    await tick();
    expect(n.calls[0]!.url).toBe('/?/water');
    expect(n.calls[0]!.headers['x-sveltekit-action']).toBe('true');
    expect(n.calls[0]!.fields).toEqual({ ml: ['250'], key: ['k1'] });
    n.calls[0]!.answer(ok('Water 250 ml saved.'));
    expect(await p).toEqual({ kind: 'answer', answer: { head: 'Water 250 ml saved.' } });
  });

  it('gives every tap a new key, and a keyless route none', async () => {
    const n = fakeNet();
    let i = 0;
    const s = new Saver({ ...n, storage: null, newKey: () => `key-${++i}` });
    void s.send('water', {});
    void s.send('water', {});
    void s.send('answer', { question_id: 'q1', reply: 'yes' });
    await tick();
    expect(n.calls.map((c) => c.fields.key)).toEqual([['key-1'], ['key-2'], undefined]);
  });

  it('keeps only the newest answer when two saves overlap', async () => {
    const n = fakeNet();
    const s = new Saver({ ...n, storage: null });
    const first = s.send('water', {});
    const second = s.send('habit', { name: 'meds', action: 'tick' });
    await tick();
    n.calls[1]!.answer(ok('Meds ticked.'));
    n.calls[0]!.answer(ok('Water saved.')); // came back last, but is older: its day is out of date
    expect(await second).toEqual({ kind: 'answer', answer: { head: 'Meds ticked.' } });
    expect(await first).toEqual({ kind: 'stale' });
  });

  it('takes an older answer that comes first, then the newer one', async () => {
    const n = fakeNet();
    const s = new Saver({ ...n, storage: null });
    const first = s.send('water', {});
    const second = s.send('water', {});
    await tick();
    n.calls[0]!.answer(ok('one'));
    expect(await first).toMatchObject({ kind: 'answer' });
    n.calls[1]!.answer(ok('two'));
    expect(await second).toMatchObject({ kind: 'answer', answer: { head: 'two' } });
  });

  it('says what went wrong, and that nothing was saved when the network fails', async () => {
    const n = fakeNet();
    const s = new Saver({ ...n, storage: null });
    const p = s.send('water', {});
    await tick();
    n.calls[0]!.answer({ type: 'failure', status: 500, data: { signedOut: false, message: 'The logger is not answering right now.' } });
    expect(await p).toEqual({ kind: 'problem', message: 'The logger is not answering right now.' });
    const down = new Saver({ fetch: () => Promise.reject(new Error('offline')), deserialize: n.deserialize, storage: null });
    expect(await down.send('water', {})).toMatchObject({ kind: 'problem', message: expect.stringContaining('Nothing was saved') });
  });

  it('keeps a tap that met a gone session, and sends it again after the sign-in with the same key', async () => {
    const n = fakeNet();
    const store = memory();
    let t = 1_000_000;
    const s = new Saver({ ...n, storage: store, newKey: () => 'the-key', now: () => t });
    const p = s.send('checkin', { type: 'mood', value: '4' });
    await tick();
    n.calls[0]!.answer({ type: 'failure', status: 401, data: { signedOut: true, message: 'Sign in first.' } });
    expect(await p).toEqual({ kind: 'signed_out' });
    expect(store.m.has(RESEND_ITEM)).toBe(true);

    // a fresh page after the sign-in
    t += 60_000;
    const after = new Saver({ ...n, storage: store, newKey: () => 'another-key', now: () => t });
    const again = after.resend();
    await tick();
    expect(n.calls[1]!.url).toBe('/?/checkin');
    expect(n.calls[1]!.fields).toEqual({ type: ['mood'], value: ['4'], key: ['the-key'] });
    n.calls[1]!.answer(ok('Mood 4 saved.'));
    expect(await again).toMatchObject({ kind: 'answer' });
    expect(store.m.has(RESEND_ITEM)).toBe(false); // sent once only
    expect(await after.resend()).toBeNull();
  });

  it('does not re-send an old tap, or one the door cannot tell apart (no key)', async () => {
    const n = fakeNet();
    const store = memory();
    let t = 0;
    const s = new Saver({ ...n, storage: store, now: () => t });
    const p = s.send('water', {});
    await tick();
    n.calls[0]!.answer({ type: 'failure', status: 401, data: { signedOut: true } });
    await p;
    t += RESEND_MS + 1;
    expect(await s.resend()).toBeNull();
    expect(store.m.has(RESEND_ITEM)).toBe(false);

    const q = s.send('answer', { question_id: 'q1', reply: 'yes' });
    await tick();
    n.calls[1]!.answer({ type: 'failure', status: 401, data: { signedOut: true } });
    expect(await q).toEqual({ kind: 'signed_out' });
    expect(store.m.has(RESEND_ITEM)).toBe(false);
    expect(n.calls).toHaveLength(2);
  });
});
