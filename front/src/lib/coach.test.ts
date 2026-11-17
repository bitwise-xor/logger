// The Coach page and Today's Coach card (deploy 109): the plain rules against real answers of the door for invented coachings
// (tests/samples/coach.json, day.json), and the day coaching's button: one press sends one start, never again by itself.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  arrowed,
  askedDay,
  askedFilter,
  berlinToday,
  coachFields,
  coachHref,
  goalsLink,
  latestDay,
  mealLine,
  partWarns,
  todayFields,
  toggled,
  type CoachRead,
} from './coach.js';
import type { Day } from './day.js';
import { mayResend, RESEND_ITEM, Saver, type ActionResult } from './saver.js';
import { doorLink, GOALS_HERE, OneStart } from './week.js';

const C = JSON.parse(readFileSync(new URL('../../tests/samples/coach.json', import.meta.url), 'utf8')) as Record<string, { coach: CoachRead }> & { saves: Record<string, { head: string; reason: string | null }> };
const D = JSON.parse(readFileSync(new URL('../../tests/samples/day.json', import.meta.url), 'utf8')).day as Day;

describe('the address', () => {
  it('keeps a filter of the door\'s and a real day; anything else is dropped', () => {
    expect(askedFilter('days')).toBe('days');
    expect(askedFilter('weeks')).toBe('weeks');
    expect(askedFilter('all')).toBe('all');
    expect(askedFilter('week')).toBeUndefined();
    expect(askedFilter(null)).toBeUndefined();
    expect(askedDay('2026-11-16')).toBe('2026-11-16');
    expect(askedDay('2026-02-30')).toBeUndefined();
    expect(askedDay('16.11.2026')).toBeUndefined();
    expect(askedDay('')).toBeUndefined();
    expect(askedDay(null)).toBeUndefined();
  });

  it('is the page itself for all coachings and today', () => {
    expect(coachHref()).toBe('/coach');
    expect(coachHref({ f: 'all' })).toBe('/coach');
    expect(coachHref({ f: 'weeks' })).toBe('/coach?f=weeks');
    expect(coachHref({ f: 'days', day: '2026-11-14' })).toBe('/coach?f=days&day=2026-11-14');
    expect(coachHref({ day: '2026-11-14' })).toBe('/coach?day=2026-11-14');
    expect(coachHref({ f: 'nonsense', day: 'x' })).toBe('/coach');
    // the door's three chips lead to these
    expect(C.all!.coach.filters.map((x) => coachHref({ f: x.f }))).toEqual(['/coach', '/coach?f=days', '/coach?f=weeks']);
  });

  it('offers days up to today here, or the day asked when that is later', () => {
    expect(berlinToday(new Date('2026-11-17T23:30:00Z'))).toBe('2026-11-18'); // already the 18th in Berlin
    expect(berlinToday(new Date('2026-07-01T12:00:00Z'))).toBe('2026-07-01');
    expect(latestDay('2026-11-17', undefined, new Date('2030-01-01T00:00:00Z'))).toBe('2026-11-17');
    expect(latestDay('2026-11-14', '2026-11-14', new Date('2026-11-17T12:00:00Z'))).toBe('2026-11-17');
    expect(latestDay('2026-11-20', '2026-11-20', new Date('2026-11-17T12:00:00Z'))).toBe('2026-11-20');
  });
});

describe('the list', () => {
  it('has the door\'s three chips, one current, and a heading, first line and meta line per coaching', () => {
    for (const k of ['all', 'days', 'weeks'] as const) {
      const r = C[k]!.coach;
      expect(r.filters.map((x) => x.label)).toEqual(['All', 'Days', 'Weeks']);
      expect(r.filters.filter((x) => x.current).map((x) => x.f)).toEqual([r.f]);
      for (const c of r.list) {
        expect(c.heading).toMatch(c.kind === 'day' ? /^[A-Z][a-z]{2} \d\d\.\d\d\.$/ : /^Week \d\d\.\d\d\. to \d\d\.\d\d\.$/);
        expect(c.meta?.text).toMatch(/^Claude Opus · \$\d+\.\d\d · \d\d\.\d\d\. \d\d:\d\d$/);
        expect(c.caution).toBeTruthy();
      }
    }
    expect(C.days!.coach.list.every((c) => c.kind === 'day')).toBe(true);
    expect(C.weeks!.coach.list.every((c) => c.kind === 'week')).toBe(true);
  });

  it('says its words when nothing is there, and has the month line and the note', () => {
    expect(C.empty!.coach.list).toEqual([]);
    expect(C.empty!.coach.empty).toMatch(/^No coachings yet/);
    expect(C.all!.coach.month.text).toMatch(/^This month: \d+ coachings? · \$\d+\.\d\d \(also on the Usage page\)\.$/);
    expect(C.all!.coach.note).toMatch(/Coach me again/);
  });

  it('opens one row at a time, and a second tap closes it', () => {
    expect(toggled(null, 3)).toBe(3);
    expect(toggled(3, 3)).toBeNull();
    expect(toggled(3, 1)).toBe(1);
  });
});

describe('the parts', () => {
  it('draw "To improve" in amber, and no other tone', () => {
    const day = C.all!.coach.list.find((c) => c.kind === 'day')!;
    expect(day.parts.filter(partWarns).map((p) => p.key)).toEqual(['improve']);
    expect(day.parts.map((p) => p.tone)).toEqual(['ok', 'warn', null, null]);
    expect(C.weeks!.coach.list.flatMap((c) => c.parts).some(partWarns)).toBe(false);
  });

  it('give the next meal its line: the door\'s own, else its four numbers', () => {
    const meal = C.all!.coach.list[0]!.parts.find((p) => p.style === 'meal')!.meal!;
    expect(mealLine(meal)).toBe('380 kcal · 34 g protein · 6 g carbs · 25 g fat');
    expect(mealLine({ ...meal, macros: null })).toBe('380 kcal · 34 g protein · 6 g carbs · 25 g fat');
    expect(mealLine({ ...meal, macros: null, carbs: null })).toBe('380 kcal · 34 g protein · 25 g fat');
  });

  it('are in the door\'s order, a week review\'s with a numbered focus', () => {
    const week = C.weeks!.coach.list[0]!;
    expect(week.parts.map((p) => [p.key, p.style])).toEqual([['targets', 'list'], ['trends', 'list'], ['habits', 'list'], ['days', 'list'], ['focus', 'numbered']]);
  });
});

describe('the card', () => {
  it('is the door\'s, in each of its four states, with its button words', () => {
    const states = (['day_none', 'day_done', 'day_failed'] as const).map((k) => C[k]!.coach.card);
    expect(states.map((c) => [c.state, c.button])).toEqual([['none', 'Coach me'], ['done', 'Coach me again'], ['failed', 'Coach me']]);
    const working = C.all!.coach.card;
    expect([working.state, working.button, working.wait]).toEqual(['working', null, 'Coaching… about 30 seconds']);
    expect(states[1]!.parts.length).toBeGreaterThan(0);
    expect(states[2]!.failed).toMatch(/^That did not work/);
  });

  it('has Today\'s card in the day, null when Settings hides it', () => {
    expect(D.coach?.kind).toBe('day');
    expect(D.coach?.start).toBe(D.day);
    expect(({ ...D, coach: null } as Day).coach).toBeNull();
  });

  it('asks for the card\'s day twice, with the page\'s filter and day for the fresh page, and no key', () => {
    const card = C.day_none!.coach.card;
    expect(coachFields(card, { f: 'weeks', day: card.start })).toEqual({ start: card.start, end: card.start, view_f: 'weeks', view_day: card.start });
    expect(todayFields(card)).toEqual({ start: card.start, end: card.start, view_day: card.start });
    expect(coachFields({ start: '', end: '' }, { f: 'all', day: '' })).toBeNull();
    expect('key' in coachFields(card, { f: 'all', day: card.start })!).toBe(false);
  });

  it('links to the Coach page and to Your goals, with the arrow', () => {
    const links = D.coach!.links;
    expect(links.map((l) => arrowed(l.label))).toEqual(['All coachings ›', 'Your goals ›']);
    expect(goalsLink(D.coach)).toEqual({ label: 'Your goals', href: '/web/settings?tab=coach' });
    expect(goalsLink(null).label).toBe('Your goals');
  });
});

describe('the door\'s links', () => {
  const app = 'https://app.example';
  it('open the Coach page here, with the weeks filter the door\'s link has', () => {
    expect(doorLink(app, '/web/coach')).toBe('/coach');
    expect(doorLink(app, '/web/coach?f=weeks')).toBe('/coach?f=weeks');
    expect(doorLink(app, '/web/coach?f=days')).toBe('/coach?f=days');
    expect(doorLink(app, '/web/coach?f=bad')).toBe('/coach');
  });

  it('open Your goals in one place: app. until Settings is here (deploy 111, GOALS_HERE)', () => {
    expect(GOALS_HERE).toBeNull();
    expect(doorLink(app, '/web/settings?tab=coach')).toBe('https://app.example/web/settings?tab=coach');
    expect(doorLink(app, '/web/settings?tab=today')).toBe('https://app.example/web/settings?tab=today');
  });

  it('leave other pages at app., and a link that is no path of the door\'s at app.\'s start page', () => {
    expect(doorLink(app, '/web/week')).toBe('https://app.example/web/week');
    expect(doorLink(app, 'https://elsewhere.example/')).toBe('https://app.example/web/');
  });
});

// ---- the day coaching's button: one press, one start --------------------------------------------------------------------------

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
const FIELDS = { start: '2026-11-12', end: '2026-11-12', view_f: 'all', view_day: '2026-11-12' };

describe('the day coaching\'s start', () => {
  it('sends one start for presses made while it is on its way, to the page\'s form action, with no key', async () => {
    for (const page of ['/', '/coach']) {
      const n = fakeNet();
      const s = new Saver({ ...n, storage: memory(), newKey: () => 'never-a-key-000001', page });
      const one = new OneStart();
      const press = () => one.press(() => s.send('coach_day', { ...FIELDS }));
      const a = press();
      const b = press();
      const c = press();
      await tick();
      expect(n.calls).toHaveLength(1);
      expect(n.calls[0]!.url).toBe(`${page}?/coach_day`);
      expect(n.calls[0]!.fields).toEqual({ start: ['2026-11-12'], end: ['2026-11-12'], view_f: ['all'], view_day: ['2026-11-12'] });
      expect(await b).toBeNull();
      expect(await c).toBeNull();
      n.calls[0]!.answer({ type: 'success', status: 200, data: { answer: C.saves!.start } });
      expect((await a)?.kind).toBe('answer');
      // the owner's next press, after the answer, is a press of its own
      void press();
      await tick();
      expect(n.calls).toHaveLength(2);
    }
  });

  it('is not retried after a network error: it says the coaching may have started, and nothing is kept', async () => {
    const n = fakeNet();
    const store = memory();
    const s = new Saver({ ...n, storage: store, page: '/coach' });
    const r = new OneStart().press(() => s.send('coach_day', { ...FIELDS }));
    await tick();
    n.calls[0]!.fail();
    const sent = await r;
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
    const s = new Saver({ ...n, storage: store, page: '/' });
    const r = s.send('coach_day', { ...FIELDS });
    await tick();
    n.calls[0]!.answer({ type: 'failure', status: 401, data: { signedOut: true } });
    expect(await r).toEqual({ kind: 'signed_out' });
    expect(store.m.has(RESEND_ITEM)).toBe(false);
    expect(mayResend('coach_day')).toBe(false);
    store.setItem(RESEND_ITEM, JSON.stringify({ action: 'coach_day', fields: { ...FIELDS, key: 'old-key-0123456789' }, at: Date.now(), page: '/' }));
    expect(await s.resend()).toBeNull();
    expect(n.calls).toHaveLength(1);
  });

  it('says a refusal in the door\'s words and sends nothing more', async () => {
    const n = fakeNet();
    const s = new Saver({ ...n, storage: memory(), page: '/coach' });
    const r = s.send<{ outcome: string; reason: string }>('coach_day', { ...FIELDS });
    await tick();
    n.calls[0]!.answer({ type: 'success', status: 200, data: { answer: C.saves!.limit } });
    const sent = await r;
    expect(sent.kind === 'answer' && sent.answer.reason).toBe('That is 10 coachings today, the daily limit. Tomorrow there are new ones.');
    await new Promise((x) => setTimeout(x, 20));
    expect(n.calls).toHaveLength(1);
  });
});
