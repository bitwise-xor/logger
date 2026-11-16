// Trends' Week tab (deploy 102): the plain rules against the door's sample (tests/samples/week.json), and the Week review's two
// browser rules: a start is never sent twice or again by the page, and a review being read is asked about every 5 s for 5 minutes.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { mayResend, RESEND_ITEM, Saver, type ActionResult } from './saver.js';
import {
  appLink,
  askedPeriod,
  DAYS_SHOWN,
  FOODS_SHOWN,
  headLine,
  kgText,
  meterFill,
  meterWarn,
  OneStart,
  pctText,
  periodHref,
  POLL_LIMIT_MS,
  POLL_MS,
  shown,
  startFields,
  StatusPoll,
  statusOf,
  TRENDS_TABS,
  type Asked,
  type Week,
} from './week.js';

const S = JSON.parse(readFileSync(new URL('../../tests/samples/week.json', import.meta.url), 'utf8'));
const W = (k: string): Week => S[k].week;

describe('the Week', () => {
  it('takes the period of the address, and 7 for anything else', () => {
    expect(['7', 'last', '30', 'this'].map(askedPeriod)).toEqual(['7', 'last', '30', 'this']);
    for (const bad of [null, '', '90', 'LAST', '7 ', 'week']) expect(askedPeriod(bad)).toBe('7');
    expect(W('7').periods.map((x) => periodHref(x.p))).toEqual(['/trends', '/trends?p=last', '/trends?p=30', '/trends?p=this']);
  });

  it('writes the header line from the door\'s parts, as app. joins them', () => {
    expect(headLine(W('last_done'))).toBe('Mon 02.11. to Sun 08.11.2026 · 6 of 7 days with food');
    expect(headLine(W('30'))).toBe(`${W('30').dates_text} · ${W('30').days_text} · 2 partly logged days left out (16.10., 25.10.: under half the calorie target)`);
    expect(headLine(W('this_monday'))).toBe('');
  });

  it('draws the meter with the 100% line at 80% of the track, amber only for warn', () => {
    expect(meterFill(100)).toBe(80);
    expect(meterFill(50)).toBe(40);
    expect(meterFill(125)).toBe(100);
    expect(meterFill(200)).toBe(100);
    expect(meterFill(null)).toBe(0);
    expect(meterFill(0)).toBe(0);
    const tiles = W('last_done').food;
    expect(tiles.map((t) => [t.key, t.level, meterWarn(t)])).toEqual([
      ['kcal', 'warn', true],
      ['protein', 'warn', true],
      ['fat', 'good', false],
      ['carbs', 'bad', false],
    ]);
    expect(tiles.map((t) => pctText(t.pct))).toEqual(['105%', '87%', '90%', '110%']);
    expect(pctText(null)).toBe('');
    expect(pctText(96.5)).toBe('96%'); // half to even, as app.
  });

  it('shows five foods and seven days until "Show all"', () => {
    const w = W('30');
    expect(shown(w.days, DAYS_SHOWN, false)).toHaveLength(7);
    expect(shown(w.days, DAYS_SHOWN, true)).toHaveLength(w.days.length);
    expect(shown(w.foods.by_kcal, FOODS_SHOWN, false)).toHaveLength(5);
    expect(kgText(80.51)).toBe('80.5');
    expect(kgText(null)).toBe('–');
  });

  it('has the tabs Week, Charts and Insights; Charts and Insights open app. until deploy 103', () => {
    expect(TRENDS_TABS.map((t) => [t.key, t.label, t.href, t.app])).toEqual([
      ['week', 'Week', '/trends', null],
      ['charts', 'Charts', null, '/web/food/trends'],
      ['insights', 'Insights', null, '/web/insights'],
    ]);
  });

  it('opens the review\'s links at app.', () => {
    const r = W('last_done').review!;
    expect(r.links.map((l) => appLink('https://app.example', l.href))).toEqual(['https://app.example/web/coach', 'https://app.example/web/settings?tab=coach']);
    expect(appLink('https://app.example', 'https://elsewhere.example/')).toBe('https://app.example/web/');
  });

  it('sends the card\'s period and the page\'s, only when the door offers a review', () => {
    expect(startFields(W('last_none').review!, 'last')).toEqual({ start: '2026-11-02', end: '2026-11-08', view_p: 'last' });
    expect(startFields(W('this_cut_off').review!, 'this')).toEqual({ start: '2026-11-09', end: '2026-11-10', view_p: 'this' });
    expect(startFields(W('7').review!, '7')).toBeNull();
  });
});

// ---- a start is never sent twice, and never again by the page ----------------------------------------------------------------

interface Call {
  url: string;
  fields: Record<string, string[]>;
  answer: (r: ActionResult) => void;
  fail: () => void;
}

function fakeNet() {
  const calls: Call[] = [];
  const fetch = (url: string, init: RequestInit) =>
    new Promise<Response>((resolve, reject) => {
      const fields: Record<string, string[]> = {};
      (init.body as FormData).forEach((v, k) => (fields[k] ??= []).push(String(v)));
      calls.push({ url, fields, answer: (r) => resolve(new Response(JSON.stringify(r))), fail: () => reject(new TypeError('Failed to fetch')) });
    });
  return { calls, fetch, deserialize: (t: string) => JSON.parse(t) as ActionResult };
}

function memory() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), m };
}

const tick = () => new Promise((r) => setTimeout(r, 0));
const FIELDS = { start: '2026-11-02', end: '2026-11-08', view_p: 'last' };
const started = (): ActionResult => ({ type: 'success', status: 200, data: { answer: { ...S.saves.start, week: W('this_working') } } });

describe('the Week review\'s start', () => {
  it('sends one start for presses made while it is on its way, with no key', async () => {
    const n = fakeNet();
    const s = new Saver({ ...n, storage: memory(), newKey: () => 'never-a-key-000001', page: '/trends' });
    const one = new OneStart();
    const press = () => one.press(() => s.send('coach_start', { ...FIELDS }));
    const a = press();
    const b = press();
    const c = press();
    await tick();
    expect(n.calls).toHaveLength(1);
    expect(n.calls[0]!.url).toBe('/trends?/coach_start');
    expect(n.calls[0]!.fields).toEqual({ start: ['2026-11-02'], end: ['2026-11-08'], view_p: ['last'] });
    expect(await b).toBeNull();
    expect(await c).toBeNull();
    expect(one.busy).toBe(true);
    n.calls[0]!.answer(started());
    expect((await a)?.kind).toBe('answer');
    expect(one.busy).toBe(false);
    // the owner's next press (after the answer is in) is a press of its own
    void press();
    await tick();
    expect(n.calls).toHaveLength(2);
  });

  it('is not retried after a network error: it says so once, and says the review may have started', async () => {
    const n = fakeNet();
    const store = memory();
    const s = new Saver({ ...n, storage: store, page: '/trends' });
    const one = new OneStart();
    const r = one.press(() => s.send('coach_start', { ...FIELDS }));
    await tick();
    n.calls[0]!.fail();
    const sent = await r;
    expect(sent?.kind).toBe('problem');
    expect(sent?.kind === 'problem' && sent.message).toMatch(/may have started/);
    expect(sent?.kind === 'problem' && sent.message).not.toMatch(/Nothing was saved/);
    await new Promise((x) => setTimeout(x, 50));
    expect(n.calls).toHaveLength(1);
    expect(store.m.size).toBe(0);
    expect(await s.resend()).toBeNull();
    expect(n.calls).toHaveLength(1);
  });

  it('is never kept for after a sign-in, and never sent again then', async () => {
    const n = fakeNet();
    const store = memory();
    const s = new Saver({ ...n, storage: store, page: '/trends' });
    const r = s.send('coach_start', { ...FIELDS });
    await tick();
    n.calls[0]!.answer({ type: 'failure', status: 401, data: { signedOut: true } });
    expect(await r).toEqual({ kind: 'signed_out' });
    expect(store.m.has(RESEND_ITEM)).toBe(false);
    expect(mayResend('coach_start')).toBe(false);
    // not even one kept by an old tab, with a key
    store.setItem(RESEND_ITEM, JSON.stringify({ action: 'coach_start', fields: { ...FIELDS, key: 'old-key-0123456789' }, at: Date.now(), page: '/trends' }));
    expect(await s.resend()).toBeNull();
    expect(n.calls).toHaveLength(1);
  });

  it('says a refusal (the daily limit) in the door\'s words and sends nothing more', async () => {
    const n = fakeNet();
    const s = new Saver({ ...n, storage: memory(), page: '/trends' });
    const r = s.send<{ outcome: string; reason: string }>('coach_start', { ...FIELDS });
    await tick();
    n.calls[0]!.answer({ type: 'success', status: 200, data: { answer: { ...S.saves.limit, week: W('last_none') } } });
    const sent = await r;
    expect(sent.kind === 'answer' && [sent.answer.outcome, sent.answer.reason]).toEqual(['rejected', 'That is 10 coachings today, the daily limit. Tomorrow there are new ones.']);
    await new Promise((x) => setTimeout(x, 20));
    expect(n.calls).toHaveLength(1);
  });
});

// ---- the poll while a review is read ------------------------------------------------------------------------------------------

function fakeClock() {
  let now = 0;
  let fn: (() => void) | null = null;
  return {
    now: () => now,
    every: (f: () => void, ms: number) => {
      expect(ms).toBe(POLL_MS);
      fn = f;
      return () => (fn = null);
    },
    async step(ms = POLL_MS) {
      now += ms;
      fn?.();
      await tick();
      await tick();
    },
    get on() {
      return fn !== null;
    },
  };
}

describe('the poll of a review being read', () => {
  it('reads the status answer: working, over (done, failed, gone), signed out, trouble', () => {
    for (const k of ['done', 'failed', 'gone']) expect(statusOf(200, S.status[k])).toBe('over');
    expect(statusOf(200, S.status.working)).toBe('working');
    expect(statusOf(401, { error: 'signed_out' })).toBe('signed_out');
    expect(statusOf(502, { error: 'server_error' })).toBe('trouble');
    expect(statusOf(200, null)).toBe('trouble');
  });

  it('asks every 5 s and stops when it is over, then reads the week again once', async () => {
    const clock = fakeClock();
    const answers: Asked[] = ['working', 'trouble', 'working', 'over'];
    let asked = 0;
    let over = 0;
    const p = new StatusPoll({ ask: async () => answers[asked++]!, over: () => over++, signedOut: () => {}, slow: () => {}, ...clock });
    p.start();
    for (let i = 0; i < 4; i++) await clock.step();
    expect(asked).toBe(4);
    expect(over).toBe(1);
    expect(p.running).toBe(false);
    expect(clock.on).toBe(false);
  });

  it('stops after 5 minutes and says it takes longer', async () => {
    const clock = fakeClock();
    let asked = 0;
    let slow = 0;
    const p = new StatusPoll({ ask: async () => (asked++, 'working'), over: () => {}, signedOut: () => {}, slow: () => slow++, ...clock });
    p.start();
    for (let t = POLL_MS; t < POLL_LIMIT_MS; t += POLL_MS) await clock.step();
    expect(slow).toBe(0);
    expect(asked).toBe(POLL_LIMIT_MS / POLL_MS - 1);
    await clock.step();
    expect(slow).toBe(1);
    expect(p.running).toBe(false);
    await clock.step();
    expect(asked).toBe(POLL_LIMIT_MS / POLL_MS - 1);
  });

  it('asks no second time while an answer is on its way, and stops on a gone session', async () => {
    const clock = fakeClock();
    let release: (a: Asked) => void = () => {};
    let asked = 0;
    let out = 0;
    const p = new StatusPoll({ ask: () => (asked++, new Promise<Asked>((r) => (release = r))), over: () => {}, signedOut: () => out++, slow: () => {}, ...clock });
    p.start();
    await clock.step();
    await clock.step();
    expect(asked).toBe(1);
    release('signed_out');
    await tick();
    expect(out).toBe(1);
    expect(p.running).toBe(false);
  });
});
