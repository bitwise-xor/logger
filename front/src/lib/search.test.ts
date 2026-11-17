// More's Search (deploy 108): the question, the counts, and where each kind of row leads, against real answers of the door for invented
// data (tests/samples/search.json).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { askedQ, askedWorkout, ateHref, choreHref, countText, foodHref, GROUP_KEYS, searchable, testHref, thoughtsHref, workoutHref, type Search } from './search.js';
import { catalogueHref, viewOf } from './catalogue.js';
import { testsViewOf } from './medical.js';

const S = JSON.parse(readFileSync(new URL('../../tests/samples/search.json', import.meta.url), 'utf8')) as Record<string, { search: Search }>;

describe('the question', () => {
  it('squeezes spaces and cuts at 80, as the door does', () => {
    expect(askedQ('  oat   milk ')).toBe('oat milk');
    expect(askedQ('x'.repeat(100))).toHaveLength(80);
    expect(askedQ(null)).toBe('');
  });

  it('needs two characters', () => {
    expect(searchable('m')).toBe(false);
    expect(searchable('')).toBe(false);
    expect(searchable('ab')).toBe(true);
    expect(searchable('ää')).toBe(true);
  });

  it('keeps a workout id only when it is digits', () => {
    expect(askedWorkout('42')).toBe('42');
    expect(askedWorkout('4x')).toBeUndefined();
    expect(askedWorkout('')).toBeUndefined();
    expect(askedWorkout(null)).toBeUndefined();
    expect(askedWorkout('1234567890')).toBeUndefined();
  });
});

describe('the groups', () => {
  it("come in the door's order", () => {
    expect(GROUP_KEYS).toEqual(Object.keys(S.muesli!.search).filter((k) => ['foods', 'ate', 'workouts', 'chores', 'tests'].includes(k)));
  });

  it('count their rows, with a plus when cut at the limit', () => {
    expect(countText({ rows: [1, 2], more: false })).toBe('2');
    expect(countText({ rows: Array(15).fill(0), more: true })).toBe('15+');
    expect(countText({ rows: Array(15).fill(0), more: false })).toBe('15');
  });

  it('say nothing was searched under two letters, with the door’s hint', () => {
    const m = S.m!.search;
    expect(m.searched).toBe(false);
    expect(m.hint).toMatch(/^Type at least two letters/);
    expect(GROUP_KEYS.every((k) => m[k].rows.length === 0)).toBe(true);
  });
});

describe("a row's link", () => {
  it('opens a catalogue food in Library with the search kept, as Library reads it', () => {
    const r = S.muesli!.search.foods.rows[0]!;
    const href = foodHref('muesli', r);
    expect(href).toBe(`/library?q=muesli&food=N${r.food_id}`);
    const v = viewOf(new URL(href, 'http://x').searchParams);
    expect(v.q).toBe('muesli');
    expect(v.food).toBe(r.food_id);
    expect(href).toBe(catalogueHref({ q: 'muesli', food: r.food_id }));
  });

  it('opens a meal on its day with that row open', () => {
    const r = S.muesli!.search.ate.rows[0]!;
    expect(ateHref(r)).toBe(`/food?day=${r.day}&open=${r.ref}`);
    expect(ateHref({ day: '2026-11-16', ref: 'f12' })).toBe('/food?day=2026-11-16&open=f12');
  });

  it("opens a workout's card in the Gym's History", () => {
    const r = S.rowing!.search.workouts.rows[0]!;
    expect(workoutHref(r)).toBe(`/gym/history?w=${r.workout_id}#${r.anchor}`);
  });

  it('opens a chore on its own page', () => {
    const r = S.stove!.search.chores.rows[0]!;
    expect(choreHref(r)).toBe(`/home/chore?id=${r.chore_id}`);
  });

  it('opens a lab test, as Tests over time reads it', () => {
    const r = S.vitamin!.search.tests.rows[0]!;
    const href = testHref(r);
    expect(href).toBe(`/medical/tests?t=${r.test_id}`);
    expect(testsViewOf(new URL(href, 'http://x').searchParams).t).toBe(r.test_id);
  });

  it('sends thoughts to app., the words encoded', () => {
    expect(thoughtsHref('https://app.example.org', 'oat milk')).toBe('https://app.example.org/web/search?q=oat%20milk');
    expect(thoughtsHref('https://app.example.org', 'a&b=c')).toBe('https://app.example.org/web/search?q=a%26b%3Dc');
  });

  it('has no thoughts in any answer', () => {
    expect(JSON.stringify(S)).not.toMatch(/thought/i);
  });
});
