// Saving in place in the browser, against a faked network: the key rule, newest answer wins, and the re-send after a sign-in.
import { describe, expect, it, vi } from 'vitest';
import { fingerprint, savesInFlight, KEYED, LONG_WAIT_MS, mayResend, RESEND_ITEM, RESEND_MS, Saver, UNANSWERED_ITEM, WAIT_MS, waitMs, type ActionResult } from './saver.js';

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

  it('counts the saves on their way (Web 67)', async () => {
    const n = fakeNet();
    const s = new Saver({ ...n, storage: null });
    const before = savesInFlight(); // the tests above leave some taps unanswered on purpose
    const a = s.send('water', {});
    const b = s.send('water', {});
    await tick();
    expect(savesInFlight()).toBe(before + 2);
    n.calls[0]!.answer(ok('Saved.'));
    await a;
    expect(savesInFlight()).toBe(before + 1);
    n.calls[1]!.answer(ok('Saved.'));
    await b;
    expect(savesInFlight()).toBe(before);
    const failing = new Saver({ fetch: () => Promise.reject(new Error('x')), deserialize: n.deserialize, storage: null });
    await failing.send('water', {});
    expect(savesInFlight()).toBe(before);
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
    // offline before the send: nothing went out (Web 65)
    const down = new Saver({ fetch: () => Promise.reject(new Error('offline')), deserialize: n.deserialize, storage: null, online: () => false });
    expect(await down.send('water', {})).toMatchObject({ kind: 'problem', message: expect.stringContaining('Nothing was saved') });
  });

  describe('a tap that got no answer (Web 65)', () => {
    /** A network that fails every send after it went out (a dropped connection), noting the keys it saw. */
    function dropping() {
      const keys: (string | undefined)[] = [];
      const fetch = (_url: string, init: RequestInit) => {
        keys.push((init.body as FormData).get('key')?.toString());
        return Promise.reject(new TypeError('Load failed'));
      };
      return { keys, fetch, deserialize: (t: string) => JSON.parse(t) as ActionResult };
    }

    it('says it may have been saved, never "nothing was saved"', async () => {
      const d = dropping();
      const s = new Saver({ ...d, storage: memory(), online: () => true });
      const keyed = await s.send('water', { ml: '250' });
      expect(keyed).toEqual({ kind: 'problem', message: expect.stringMatching(/may have been saved: try again, it will not be saved twice/) });
      const plain = await s.send('food_note', { ref: 'f7', note: 'x' });
      expect(plain).toEqual({ kind: 'problem', message: expect.stringMatching(/may have been saved: reload the page to look before you try again/) });
      for (const p of [keyed, plain]) expect(p.kind === 'problem' && p.message).not.toMatch(/Nothing was saved/);
      // the keyed saves the core does not replay (problems.ts, replays): a day tap toggles, the list's forms and an untick take no key
      for (const [action, fields] of [['habit_day', { name: 'walk', day: '2026-11-20' }], ['habits_manage', { action: 'retire', name: 'walk' }], ['habit', { name: 'walk', action: 'untick' }]] as const) {
        expect(await s.send(action, fields), action).toEqual({ kind: 'problem', message: expect.stringMatching(/reload the page to look before you try again/) });
      }
      expect(await s.send('habit', { name: 'walk', action: 'tick' })).toEqual({ kind: 'problem', message: expect.stringMatching(/will not be saved twice/) });
      // the coaching keeps its own words
      expect(await s.send('coach_day', { start: '2026-11-20' })).toMatchObject({ message: expect.stringMatching(/may have started/) });
    });

    it('sends the same tap again with the same key within 10 minutes, so the door answers with the first answer', async () => {
      const d = dropping();
      const store = memory();
      let now = 1_000_000;
      let i = 0;
      const s = new Saver({ ...d, storage: store, online: () => true, now: () => now, newKey: () => `k${++i}` });
      await s.send('water', { ml: '250' });
      expect(store.m.get(UNANSWERED_ITEM)).not.toContain('250'); // a fingerprint, not the fields
      now += 9 * 60_000;
      await s.send('water', { ml: '250' });
      await s.send('water', { ml: '500' }); // another tap: a new key
      await s.send('again', { ml: '250' }); // another action: a new key
      expect(d.keys).toEqual(['k1', 'k1', 'k2', 'k3']);
      // another Saver of the same tab (another page's) finds it too, but only for its own page
      const other = new Saver({ ...d, storage: store, online: () => true, now: () => now, newKey: () => 'other' });
      await other.send('water', { ml: '250' });
      const food = new Saver({ ...d, storage: store, online: () => true, now: () => now, newKey: () => 'food', page: '/food' });
      await food.send('water', { ml: '250' });
      expect(d.keys.slice(4)).toEqual(['k1', 'food']);
    });

    it('forgets it after 10 minutes, and after any answer of the door', async () => {
      const n = fakeNet();
      const store = memory();
      let now = 0;
      let i = 0;
      let net: 'drop' | 'up' = 'drop';
      const keys: string[] = [];
      const fetch = (url: string, init: RequestInit) => {
        keys.push(String((init.body as FormData).get('key')));
        return net === 'drop' ? Promise.reject(new TypeError('Load failed')) : n.fetch(url, init);
      };
      const s = new Saver({ fetch, deserialize: n.deserialize, storage: store, online: () => true, now: () => now, newKey: () => `k${++i}` });
      await s.send('water', { ml: '250' });
      now += 10 * 60_000 + 1;
      await s.send('water', { ml: '250' });
      expect(keys).toEqual(['k1', 'k2']); // over 10 minutes: a new key
      net = 'up';
      const p = s.send('water', { ml: '250' });
      await tick();
      n.calls[0]!.answer(ok('Already saved earlier (same message).'));
      await p;
      expect(keys[2]).toBe('k2'); // the replay
      expect(store.m.has(UNANSWERED_ITEM)).toBe(false);
      const q = s.send('water', { ml: '250' });
      await tick();
      n.calls[1]!.answer(ok('Water 250 ml saved.'));
      await q;
      expect(keys[3]).toBe('k3'); // a new glass of water: a new key
    });

    it('takes the server\'s "no answer in time" the same way, with its words', async () => {
      const n = fakeNet();
      let i = 0;
      const s = new Saver({ ...n, storage: memory(), online: () => true, newKey: () => `k${++i}` });
      const p = s.send('water', { ml: '250' });
      await tick();
      const words = 'No answer from Logger in time (weak connection?). It may have been saved: try again, it will not be saved twice.';
      n.calls[0]!.answer({ type: 'failure', status: 504, data: { signedOut: false, message: words, unsure: true } });
      expect(await p).toEqual({ kind: 'problem', message: words });
      void s.send('water', { ml: '250' });
      await tick();
      expect(n.calls[1]!.fields.key).toEqual(['k1']);
      // a refusal or the core down before anything was sent is an answer: the next tap gets a new key
      n.calls[1]!.answer({ type: 'failure', status: 503, data: { signedOut: false, message: 'Logger is not answering right now. Nothing was saved; try again in a minute.' } });
      await tick();
      void s.send('water', { ml: '250' });
      await tick();
      expect(n.calls[2]!.fields.key).toEqual(['k2']);
    });

    it('gives up waiting a little after the server does, and sends no key with an unkeyed tap', async () => {
      expect(waitMs('water')).toBe(WAIT_MS);
      expect(waitMs('log')).toBe(LONG_WAIT_MS);
      let signal: AbortSignal | undefined;
      const hang = (_u: string, init: RequestInit) =>
        new Promise<Response>((_r, reject) => {
          signal = init.signal ?? undefined;
          signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
        });
      vi.useFakeTimers();
      try {
        const s = new Saver({ fetch: hang, deserialize: (t) => JSON.parse(t) as ActionResult, storage: null, online: () => true });
        const p = s.send('water', {});
        await vi.advanceTimersByTimeAsync(WAIT_MS - 1);
        expect(signal?.aborted).toBe(false);
        await vi.advanceTimersByTimeAsync(1);
        expect(signal?.aborted).toBe(true);
        expect(await p).toMatchObject({ kind: 'problem', message: expect.stringMatching(/may have been saved/) });
      } finally {
        vi.useRealTimers();
      }
    });

    it('tells taps apart by page, action and fields, whatever the order of the fields', () => {
      expect(fingerprint('/', 'water', { ml: '250', key: 'a' })).toBe(fingerprint('/', 'water', { key: 'b', ml: '250' }));
      expect(fingerprint('/', 'again', { food_id: '3', time: '12:00' })).toBe(fingerprint('/', 'again', { time: '12:00', food_id: '3' }));
      expect(fingerprint('/', 'water', { ml: '250' })).not.toBe(fingerprint('/', 'water', { ml: '500' }));
      expect(fingerprint('/', 'water', { ml: '250' })).not.toBe(fingerprint('/food', 'water', { ml: '250' }));
      expect(fingerprint('/', 'usual', { items: ['1', '2'] })).not.toBe(fingerprint('/', 'usual', { items: ['2', '1'] }));
    });
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

  // Deploy 99: no Home save is ever sent again by the page, also not after a sign-in; tick, Done, Done next job and Done it earlier?
  // have a key (a new one per tap), the timer's buttons and Not today none
  it('gives the keyed Home saves a new key per tap and never keeps a Home save for a re-send after a sign-in', async () => {
    const n = fakeNet();
    const store = memory();
    let k = 0;
    const s = new Saver({ ...n, storage: store, newKey: () => `home-key-${++k}`, page: '/home/pick' });
    const taps = [
      ['home_tick', { chore_id: '3', zone_id: '1' }, true],
      ['home_tick', { chore_id: '3', zone_id: '1' }, true],
      ['home_start', { pairs: '3-1', minutes: '15' }, false],
      ['home_pause', { timer_id: '1' }, false],
      ['home_resume', { timer_id: '1' }, false],
      ['home_stop', { timer_id: '1' }, false],
      ['home_pickdone', { pairs: '3-1', timer_id: '1' }, true],
      ['home_picknext', { pairs: '3-1', timer_id: '1' }, true],
      ['home_skip', { pairs: '3-1' }, false],
      ['home_earlier', { pairs: '3-1', when: '1' }, true],
    ] as const;
    let keys = 0;
    for (const [i, [action, fields, keyed]] of taps.entries()) {
      const r = s.send(action, { ...fields });
      await tick();
      expect(n.calls[i]!.url).toBe(`/home/pick?/${action}`);
      if (keyed) expect(n.calls[i]!.fields.key, action).toEqual([`home-key-${++keys}`]);
      else expect(n.calls[i]!.fields, action).not.toHaveProperty('key');
      n.calls[i]!.answer({ type: 'failure', status: 401, data: { signedOut: true } });
      expect(await r).toEqual({ kind: 'signed_out' });
      expect(store.m.has(RESEND_ITEM), action).toBe(false);
      expect(mayResend(action), action).toBe(false);
    }
    expect(await s.resend()).toBeNull();
    expect(n.calls).toHaveLength(taps.length);
    // the rule is for every Home save by its name
    expect(mayResend('home_anything_new')).toBe(false);
  });

  // Deploy 100: Zones, History and Edit zones; All done and a starting point are keyed (a new key per tap) and still never re-sent
  it('gives All done and a starting point a key and the rest of the Zones, History and Edit saves none, and re-sends none of them', async () => {
    const n = fakeNet();
    const store = memory();
    let k = 0;
    const s = new Saver({ ...n, storage: store, newKey: () => `home-key-${++k}`, page: '/home/zones' });
    const taps: [string, Record<string, string | string[]>, boolean][] = [
      ['home_alldone', { chore_id: '2' }, true],
      ['home_startpoint', { pairs: '2-2,2-3', ago: 'week' }, true],
      ['home_remove', { ids: '7' }, false],
      ['home_earlier', { pairs: '5-2', when: '2026-11-02' }, true],
      ['home_goalset', { goal: '4' }, false],
      ['home_zonenew', { name: 'Balcony' }, false],
      ['home_zoneedit', { zone_id: '2', name: 'Bath' }, false],
      ['home_zoneactive', { zone_id: '2', on: '0' }, false],
      ['home_chorenew', { name: 'Oven', zone_id: '1', days: '90' }, false],
      ['home_choreedit', { chore_id: '3', name: 'Oven', zone_id: '1', days: '90' }, false],
      ['home_choreactive', { chore_id: '3', on: '0' }, false],
      ['home_chorezones', { chore_id: '2', zone_ids: ['1', '2'] }, false],
    ];
    let keys = 0;
    for (const [i, [action, fields, keyed]] of taps.entries()) {
      const r = s.send(action, { ...fields });
      await tick();
      expect(n.calls[i]!.url).toBe(`/home/zones?/${action}`);
      if (keyed) expect(n.calls[i]!.fields.key, action).toEqual([`home-key-${++keys}`]);
      else expect(n.calls[i]!.fields, action).not.toHaveProperty('key');
      n.calls[i]!.answer({ type: 'failure', status: 401, data: { signedOut: true } });
      expect(await r).toEqual({ kind: 'signed_out' });
      expect(store.m.has(RESEND_ITEM), action).toBe(false);
      expect(mayResend(action), action).toBe(false);
    }
    expect(await s.resend()).toBeNull();
    expect(n.calls).toHaveLength(taps.length);
  });

  it('does not send a kept Home tap again, even one kept before this rule (an old tab)', async () => {
    const n = fakeNet();
    const store = memory();
    store.setItem(RESEND_ITEM, JSON.stringify({ action: 'home_tick', fields: { chore_id: '3', zone_id: '1', key: 'old-key-0123456789' }, at: Date.now(), page: '/home' }));
    const s = new Saver({ ...n, storage: store, page: '/home' });
    expect(await s.resend()).toBeNull();
    expect(n.calls).toHaveLength(0);
    expect(store.m.has(RESEND_ITEM)).toBe(false);
  });

  it('Library (deploy 105): sends no key with a Catalogue form and never keeps one for a re-send after a sign-in, not even a kept old one', async () => {
    const n = fakeNet();
    const store = memory();
    const s = new Saver({ ...n, storage: store, newKey: () => 'never-a-key-000001', page: '/library' });
    const taps: [string, Record<string, string>][] = [
      ['catalogue_values', { id: '2', kcal: '70', view: 'catalogue' }],
      ['catalogue_words', { id: '2', act: 'add', word: 'curd' }],
      ['catalogue_barcode', { id: '2', barcode: '40000000' }],
      ['catalogue_basics', { id: '6', name: 'Apple', hide: '1' }],
      ['catalogue_unit', { id: '5', unit: 'slice', grams: '35' }],
      ['catalogue_reviewed', { id: '5' }],
      ['lookup', { text: 'crispbread', view: 'catalogue' }],
      ['answer', { question_id: 'p1', reply: 'yes', view: 'catalogue' }],
    ];
    for (const [i, [action, fields]] of taps.entries()) {
      const r = s.send(action, { ...fields });
      await tick();
      expect(n.calls[i]!.url).toBe(`/library?/${action}`);
      expect(n.calls[i]!.fields, action).not.toHaveProperty('key');
      n.calls[i]!.answer({ type: 'failure', status: 401, data: { signedOut: true } });
      expect(await r).toEqual({ kind: 'signed_out' });
      expect(store.m.has(RESEND_ITEM), action).toBe(false);
      expect(mayResend(action), action).toBe(false);
    }
    expect(mayResend('catalogue_anything_new')).toBe(false);
    // one kept by an old tab with a key is not sent again either
    store.setItem(RESEND_ITEM, JSON.stringify({ action: 'catalogue_words', fields: { id: '2', act: 'add', word: 'curd', key: 'old-key-0123456789' }, at: Date.now(), page: '/library' }));
    expect(await s.resend()).toBeNull();
    expect(n.calls).toHaveLength(taps.length);
    expect(store.m.has(RESEND_ITEM)).toBe(false);
  });

  it('Medical (deploy 106): sends no key with a value, report or course form and never keeps one for a re-send, not even a kept old one', async () => {
    const n = fakeNet();
    const store = memory();
    const s = new Saver({ ...n, storage: store, newKey: () => 'never-a-key-000001', page: '/medical' });
    const taps: [string, Record<string, string>][] = [
      ['labs_value', { id: '10', value: '12.9', view: 'labs', view_open: 'R4' }],
      ['labs_value', { id: '10', value: '12.9', confirmed: '1', view: 'labs' }],
      ['labs_report', { id: '4', title: 'Check-up', view: 'labs' }],
      ['labs_med', { id: '1', act: 'save', dose: '2000 IU', view: 'labs_meds' }],
      ['labs_med', { id: '1', act: 'end', confirmed: '1', view: 'labs_meds' }],
    ];
    for (const [i, [action, fields]] of taps.entries()) {
      const r = s.send(action, { ...fields });
      await tick();
      expect(n.calls[i]!.url).toBe(`/medical?/${action}`);
      expect(n.calls[i]!.fields, action).not.toHaveProperty('key');
      n.calls[i]!.answer({ type: 'failure', status: 401, data: { signedOut: true } });
      expect(await r).toEqual({ kind: 'signed_out' });
      expect(store.m.has(RESEND_ITEM), action).toBe(false);
      expect(mayResend(action), action).toBe(false);
    }
    expect(mayResend('labs_anything_new')).toBe(false);
    expect(KEYED.has('labs_value') || KEYED.has('labs_report') || KEYED.has('labs_med')).toBe(false);
    // one kept by an old tab with a key is not sent again either
    for (const action of ['labs_value', 'labs_report', 'labs_med']) {
      store.setItem(RESEND_ITEM, JSON.stringify({ action, fields: { id: '2', value: '1', key: 'old-key-0123456789' }, at: Date.now(), page: '/medical' }));
      expect(await s.resend(), action).toBeNull();
      expect(store.m.has(RESEND_ITEM), action).toBe(false);
    }
    expect(n.calls).toHaveLength(taps.length);
  });

  it('Medication (deploy 106): a new course is Today\'s typed line (keyed, kept for the sign-in as Today\'s is); its yes and no go through /answer', async () => {
    const n = fakeNet();
    const s = new Saver({ ...n, storage: memory(), newKey: () => 'course-key-000001', page: '/medical/meds' });
    void s.send('log', { text: 'started vitamin D 1000 IU daily', view: 'labs_meds' });
    await tick();
    expect(n.calls[0]!.url).toBe('/medical/meds?/log');
    expect(n.calls[0]!.fields).toMatchObject({ key: ['course-key-000001'], view: ['labs_meds'] });
    void s.send('answer', { question_id: 'p1', reply: 'yes', view: 'labs_meds' });
    await tick();
    expect(n.calls[1]!.url).toBe('/medical/meds?/answer');
    expect(n.calls[1]!.fields).not.toHaveProperty('key');
    expect(mayResend('log')).toBe(true);
    expect(mayResend('answer')).toBe(false);
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
    const s = new Saver({ ...n, storage: store, newKey: () => `usual-key-${++i}`, page: '/library/usual' });
    const first = s.send('usual_meal', { meal_id: '84', action: 'save', name: 'A', food_id: ['10'], amount: ['60'] });
    const second = s.send('usual_meal', { meal_id: '84', action: 'save', name: 'B', food_id: ['10'], amount: ['65'] });
    await tick();
    expect(n.calls[0]!.url).toBe('/library/usual?/usual_meal');
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
    const back = new Saver({ ...n, storage: store, page: '/library/usual' });
    const again = back.resend();
    await tick();
    expect(n.calls[3]!.url).toBe('/library/usual?/usual_new');
    expect(n.calls[3]!.fields.key).toEqual(['usual-key-3']);
    expect(n.calls[3]!.fields.food_id).toEqual(['11']);
    n.calls[3]!.answer(ok('Saved.'));
    expect(await again).toMatchObject({ kind: 'answer' });
  });
});
