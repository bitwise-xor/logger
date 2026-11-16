// Saving in place in the browser, against a faked network: the key rule, newest answer wins, and the re-send after a sign-in.
import { describe, expect, it } from 'vitest';
import { mayResend, RESEND_ITEM, RESEND_MS, Saver, type ActionResult } from './saver.js';

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
    expect(await p).toEqual({ kind: 'problem', message: 'The logger is not answering right now.', link: null });
    // the door off (step F): the bar links to app.; a link that is not a path or https is dropped
    const q = s.send('water', {});
    await tick();
    n.calls[1]!.answer({ type: 'failure', status: 503, data: { signedOut: false, message: 'Off.', link: 'https://app.example/web/' } });
    expect(await q).toEqual({ kind: 'problem', message: 'Off.', link: 'https://app.example/web/' });
    const r = s.send('water', {});
    await tick();
    n.calls[2]!.answer({ type: 'failure', status: 503, data: { signedOut: false, message: 'Off.', link: 'javascript:alert(1)' } });
    expect(await r).toEqual({ kind: 'problem', message: 'Off.', link: null });
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

  // Deploy 94: the Habits page's day tap is never sent again (the door does not replay it), its other taps are
  it('gives a day tap of the Habits page a new key each time but never keeps it for a re-send after a sign-in', async () => {
    const n = fakeNet();
    const store = memory();
    let k = 0;
    const s = new Saver({ ...n, storage: store, newKey: () => `day-key-${++k}`, page: '/habits' });
    const a = s.send('habit_day', { name: 'reading', day: '2026-11-13' });
    await tick();
    expect(n.calls[0]!.url).toBe('/habits?/habit_day');
    expect(n.calls[0]!.fields.key).toEqual(['day-key-1']);
    n.calls[0]!.answer({ type: 'failure', status: 401, data: { signedOut: true } });
    expect(await a).toEqual({ kind: 'signed_out' });
    expect(store.m.has(RESEND_ITEM)).toBe(false);
    expect(await s.resend()).toBeNull();
    expect(n.calls).toHaveLength(1);

    const b = s.send('habit_day', { name: 'reading', day: '2026-11-13' });
    await tick();
    expect(n.calls[1]!.fields.key).toEqual(['day-key-2']);
    n.calls[1]!.answer(ok('Saved.'));
    await b;

    // a list form is kept and sent again, with its key, by its own page
    const c = s.send('habits_manage', { action: 'retire', name: 'reading' });
    await tick();
    n.calls[2]!.answer({ type: 'failure', status: 401, data: { signedOut: true } });
    await c;
    expect(store.m.has(RESEND_ITEM)).toBe(true);
    const r = s.resend();
    await tick();
    expect(n.calls[3]!.fields).toEqual({ action: ['retire'], name: ['reading'], key: ['day-key-3'] });
    n.calls[3]!.answer(ok('Retired.'));
    await r;
  });

  // Deploy 96: no gym save is sent again by the page, also not after a sign-in; only the tick has a key, a new one per tap
  it('gives a gym tick a new key per tap and never keeps a gym save for a re-send after a sign-in', async () => {
    const n = fakeNet();
    const store = memory();
    let k = 0;
    const s = new Saver({ ...n, storage: store, newKey: () => `gym-key-${++k}`, page: '/gym' });
    const a = s.send('gym_tick', { exercise_id: '2', sets: '3', reps: '10', kg: '45' });
    await tick();
    expect(n.calls[0]!.url).toBe('/gym?/gym_tick');
    expect(n.calls[0]!.fields.key).toEqual(['gym-key-1']);
    n.calls[0]!.answer({ type: 'failure', status: 401, data: { signedOut: true } });
    expect(await a).toEqual({ kind: 'signed_out' });
    expect(store.m.has(RESEND_ITEM)).toBe(false);
    expect(await s.resend()).toBeNull();

    const b = s.send('gym_tick', { exercise_id: '2', sets: '3', reps: '10', kg: '45' });
    await tick();
    expect(n.calls[1]!.fields.key).toEqual(['gym-key-2']);
    n.calls[1]!.answer(ok('Saved: Shoulder press 3 × 10 at 45 kg'));
    await b;

    for (const [i, [action, fields]] of ([['gym_remove', { set_id: '62' }], ['gym_pick', { day_id: '2' }], ['gym_new', { name: 'Cable fly', kind: 'weights' }]] as const).entries()) {
      const c = s.send(action, { ...fields });
      await tick();
      expect(n.calls[2 + i]!.fields).not.toHaveProperty('key');
      n.calls[2 + i]!.answer({ type: 'failure', status: 401, data: { signedOut: true } });
      expect(await c).toEqual({ kind: 'signed_out' });
      expect(store.m.has(RESEND_ITEM)).toBe(false);
    }
    expect(await s.resend()).toBeNull();
    expect(n.calls).toHaveLength(5);
  });

  // Deploy 97: the Plan's and Exercises' saves take no key at the door and are never kept for a re-send after a sign-in
  it('never keeps a gym save of the Plan or Exercises parts for a re-send, whatever its tap', async () => {
    const n = fakeNet();
    const store = memory();
    const s = new Saver({ ...n, storage: store, newKey: () => 'k', page: '/gym/plan' });
    const taps = [
      ['gym_itemset', { item_id: '1', sets: '3', reps: '8' }],
      ['gym_itemmove', { item_id: '1', dir: 'down' }],
      ['gym_itemremove', { item_id: '1' }],
      ['gym_itemadd', { day_id: '1', exercise_id: '3' }],
      ['gym_daynew', { name: 'Arms' }],
      ['gym_dayedit', { day_id: '1', name: 'Chest' }],
      ['gym_dayactive', { day_id: '1', on: '0' }],
      ['gym_rename', { exercise_id: '1', name: 'Flat press' }],
      ['gym_active', { exercise_id: '1', on: '0' }],
      ['gym_new', { name: 'Rowing machine', kind: 'cardio' }],
    ] as const;
    for (const [i, [action, fields]] of taps.entries()) {
      const r = s.send(action, { ...fields });
      await tick();
      expect(n.calls[i]!.url).toBe(`/gym/plan?/${action}`);
      expect(n.calls[i]!.fields, action).not.toHaveProperty('key');
      n.calls[i]!.answer({ type: 'failure', status: 401, data: { signedOut: true } });
      expect(await r).toEqual({ kind: 'signed_out' });
      expect(store.m.has(RESEND_ITEM), action).toBe(false);
      expect(mayResend(action), action).toBe(false);
    }
    expect(await s.resend()).toBeNull();
    expect(n.calls).toHaveLength(taps.length);
    // the rule is for every gym save by its name, a keyed one too
    expect(mayResend('gym_tick')).toBe(false);
    expect(mayResend('gym_anything_new')).toBe(false);
    expect(mayResend('water')).toBe(true);
  });

  // Step D: the logging box's typed line
  it('never drops a typed line\'s answer for a tap made while the AI read it (its day is read after that tap\'s)', async () => {
    const n = fakeNet();
    const s = new Saver({ ...n, storage: null, newKey: () => 'line-key-0000001' });
    const line = s.send('log', { text: '40 g radishes' });
    const glass = s.send('water', {});
    await tick();
    expect(n.calls[0]!.fields).toEqual({ text: ['40 g radishes'], key: ['line-key-0000001'] });
    n.calls[1]!.answer(ok('Water saved.'));
    n.calls[0]!.answer(ok('Saved.')); // the line came back last, after the newer tap
    expect(await glass).toMatchObject({ kind: 'answer' });
    expect(await line).toEqual({ kind: 'answer', answer: { head: 'Saved.' } });
    // and a quick tap that started before the line and comes back after it is still dropped
    const older = s.send('water', {});
    const later = s.send('log', { text: 'skyr' });
    await tick();
    n.calls[3]!.answer(ok('Saved.'));
    n.calls[2]!.answer(ok('Water saved.'));
    expect(await later).toMatchObject({ kind: 'answer' });
    expect(await older).toEqual({ kind: 'stale' });
  });

  it('keeps a typed line that met a gone session, and sends its words again after the sign-in with the same key', async () => {
    const n = fakeNet();
    const store = memory();
    let t = 5_000_000;
    const s = new Saver({ ...n, storage: store, newKey: () => 'never-used-key-01', now: () => t });
    const p = s.send('log', { text: '150 g skyr\nweight 82.4', key: 'the-line-key-0001' });
    await tick();
    n.calls[0]!.answer({ type: 'failure', status: 401, data: { signedOut: true, message: 'Sign in again.' } });
    expect(await p).toEqual({ kind: 'signed_out' });

    t += 9 * 60_000;
    const after = new Saver({ ...n, storage: store, newKey: () => 'another-key-00001', now: () => t });
    const kept = after.takeKept();
    expect(kept).toMatchObject({ action: 'log', fresh: true, fields: { text: '150 g skyr\nweight 82.4', key: 'the-line-key-0001' } });
    expect(store.m.has(RESEND_ITEM)).toBe(false); // taken out: sent once at most
    const again = after.send('log', kept!.fields);
    await tick();
    expect(n.calls[1]!.fields).toEqual({ text: ['150 g skyr\nweight 82.4'], key: ['the-line-key-0001'] });
    n.calls[1]!.answer(ok('Saved.'));
    expect(await again).toMatchObject({ kind: 'answer' });
  });

  it('gives back the words of a line kept too long, so the box can show them again, but does not send them', async () => {
    const n = fakeNet();
    const store = memory();
    let t = 0;
    const s = new Saver({ ...n, storage: store, now: () => t });
    const p = s.send('log', { text: 'oats with milk' });
    await tick();
    n.calls[0]!.answer({ type: 'failure', status: 401, data: { signedOut: true } });
    await p;
    t += RESEND_MS + 1;
    expect(s.takeKept()).toMatchObject({ action: 'log', fresh: false, fields: { text: 'oats with milk' } });
    expect(s.takeKept()).toBeNull();
    expect(n.calls).toHaveLength(1);
  });

  it('the usual meals (deploy 87): a Save is keyed, the newest answer wins, and a kept one is sent again only by its own page', async () => {
    const n = fakeNet();
    const store = memory();
    let i = 0;
    const s = new Saver({ ...n, storage: store, newKey: () => `usual-key-${++i}`, page: '/food/usual' });
    const first = s.send('usual_meal', { meal_id: '84', action: 'save', name: 'A', food_id: ['10'], amount: ['60'] });
    const second = s.send('usual_meal', { meal_id: '84', action: 'save', name: 'B', food_id: ['10'], amount: ['65'] });
    await tick();
    expect(n.calls[0]!.url).toBe('/food/usual?/usual_meal');
    expect(n.calls[0]!.fields.key).toEqual(['usual-key-1']);
    expect(n.calls[1]!.fields.key).toEqual(['usual-key-2']);
    n.calls[1]!.answer(ok('Changed the usual meal "B".'));
    n.calls[0]!.answer(ok('Changed the usual meal "A".'));
    expect(await second).toMatchObject({ kind: 'answer' });
    expect(await first).toEqual({ kind: 'stale' });

    const gone = s.send('usual_new', { name: 'Shake', drink: '1', food_id: ['11'], amount: ['300'] });
    await tick();
    n.calls[2]!.answer({ type: 'failure', status: 401, data: { signedOut: true, message: 'Sign in again.' } });
    expect(await gone).toEqual({ kind: 'signed_out' });
    // Today (another page) leaves it kept; the Usual meals page sends it again, with its key
    const today = new Saver({ ...n, storage: store, page: '/' });
    expect(today.takeKept()).toBeNull();
    expect(store.m.has(RESEND_ITEM)).toBe(true);
    const back = new Saver({ ...n, storage: store, page: '/food/usual' });
    const again = back.resend();
    await tick();
    expect(n.calls[3]!.url).toBe('/food/usual?/usual_new');
    expect(n.calls[3]!.fields.key).toEqual(['usual-key-3']);
    expect(n.calls[3]!.fields.food_id).toEqual(['11']);
    n.calls[3]!.answer(ok('Saved.'));
    expect(await again).toMatchObject({ kind: 'answer' });
  });
});
