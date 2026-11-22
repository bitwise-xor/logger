import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { askedExercise } from './gymread.js';
import { askedRange } from './health.js';
import { askedDays, barStyle, chartsHref, chipHref, daysText, insightRangeLinks, insightsHref, rangeLinks, waitParts } from './trendscharts.js';
import type { FoodTrends, Insights } from './trendscharts.js';

const sample = (f: string) => JSON.parse(readFileSync(new URL(`../../tests/samples/${f}`, import.meta.url), 'utf8'));
const FOOD = sample('food_trends.json');
const food = (r: '7' | '30' | '90'): FoodTrends => FOOD[r].trends;
const ins: Insights = sample('insights.json').insights.insights;

describe('the Charts page address', () => {
  it('leaves 30 out and keeps the exercise when the range changes', () => {
    expect(chartsHref(30)).toBe('/trends/charts');
    expect(chartsHref(7)).toBe('/trends/charts?range=7');
    expect(chartsHref(90, '12')).toBe('/trends/charts?range=90&x=12');
    expect(chartsHref(30, '12')).toBe('/trends/charts?range=30&x=12');
    expect(chartsHref(30, null)).toBe('/trends/charts');
  });

  it('links the three ranges, keeps x and marks the asked one', () => {
    expect(rangeLinks(30, '5').map((l) => [l.label, l.href, l.current])).toEqual([
      ['7 days', '/trends/charts?range=7&x=5', false],
      ['30 days', '/trends/charts?range=30&x=5', true],
      ['90 days', '/trends/charts?range=90&x=5', false],
    ]);
    expect(rangeLinks(7).map((l) => l.href)).toEqual(['/trends/charts?range=7', '/trends/charts', '/trends/charts?range=90']);
  });

  it('keeps the range when an exercise chip is tapped', () => {
    expect(chipHref(90, 4)).toBe('/trends/charts?range=90&x=4');
    expect(chipHref(30, 4)).toBe('/trends/charts?range=30&x=4');
  });

  it('asks the door only for what it takes (a bad range is 30, a bad x is dropped)', () => {
    expect(askedRange('90')).toBe(90);
    expect(askedRange('45')).toBe(30);
    expect(askedRange(null)).toBe(30);
    expect(askedExercise('7')).toBe('7');
    expect(askedExercise('7;drop')).toBeUndefined();
    expect(askedExercise('')).toBeUndefined();
  });
});

describe("the door's Food trends", () => {
  it('has the four cards in the door\'s order, for every range', () => {
    for (const r of ['7', '30', '90'] as const) {
      const t = food(r);
      expect(t.charts.map((c) => c.id)).toEqual(['kcal', 'protein', 'fat', 'carbs']);
      expect(t.title).toBe(`Last ${r} complete days`);
      expect(t.small).toMatch(/today not counted$/);
      for (const c of t.charts) expect(c.chart.days).toBe(Number(r));
    }
  });
});

describe('the insight bars', () => {
  it('draws from left and width as the door gives them', () => {
    const c = ins.cards[0]!;
    expect(c.groups.map((g) => barStyle(g, c.zero))).toEqual([
      { left: 0, width: 100, zero: null },
      { left: 0, width: 90, zero: null },
    ]);
  });

  it('puts a zero line where a value below 0 moves it, and keeps every bar on its track', () => {
    expect(barStyle({ left: 20, width: 30 }, 20)).toEqual({ left: 20, width: 30, zero: 20 });
    expect(barStyle({ left: 90, width: 40 }, 0)).toEqual({ left: 90, width: 10, zero: null });
    expect(barStyle({ left: -5, width: 150 }, 140)).toEqual({ left: 0, width: 100, zero: 100 });
    expect(barStyle({ left: null, width: null }, null)).toEqual({ left: 0, width: 0, zero: null });
  });

  it('counts days', () => {
    expect([1, 24].map(daysText)).toEqual(['1 day', '24 days']);
  });

  it('has the cards with a statement first and the waiting ones after, in the door\'s order, with the door\'s note', () => {
    expect(ins.cards.map((c) => [c.key, c.waiting])).toEqual([
      ['late', false], ['carbs', false], ['late_sleep', false], ['sleep_kcal', false], ['sleep_mood', false], ['sleep_energy', false],
      ['caffeine_sleep', true], ['sleep', true], ['sleep_bp', true],
    ]);
    expect(ins.small).toBe('From the last 90 days');
    expect(ins.ranges).toEqual([90, 180, 365]);
    expect(ins.note).toMatch(/^These are patterns in your own numbers/);
    for (const c of ins.cards.filter((x) => !x.waiting)) {
      expect(c.chip).toBeTruthy();
      expect(c.groups.map((g) => g.cls)).toEqual(['a', 'b']);
    }
  });
});

describe('the Insights range', () => {
  it('reads 90, 180 or 365 from the address and falls back to 90 for anything else', () => {
    expect(['90', '180', '365'].map(askedDays)).toEqual([90, 180, 365]);
    expect([null, '', '30', 'x', '180.0', ' 180', '-90', '1e2'].map(askedDays)).toEqual([90, 90, 90, 90, 90, 90, 90, 90]);
  });

  it('leaves 90 out of the address', () => {
    expect([90, 180, 365].map(insightsHref)).toEqual(['/trends/insights', '/trends/insights?days=180', '/trends/insights?days=365']);
  });

  it('draws one chip per range, the asked one current', () => {
    expect(insightRangeLinks(180, ins.ranges).map((l) => [l.label, l.href, l.current])).toEqual([
      ['90 days', '/trends/insights', false],
      ['180 days', '/trends/insights?days=180', true],
      ['365 days', '/trends/insights?days=365', false],
    ]);
    expect(insightRangeLinks(90).map((l) => l.days)).toEqual([90, 180, 365]);
    expect(insightRangeLinks(90, []).map((l) => l.current)).toEqual([true, false, false]);
  });
});

describe('the caveat', () => {
  it('is a sentence on a card with a statement or null, never on a waiting card', () => {
    expect(ins.cards.filter((c) => c.caveat).map((c) => c.key)).toEqual(['sleep_kcal']);
    expect(ins.cards.find((c) => c.caveat)!.caveat).toMatch(/^The difference is smaller than the usual day-to-day spread \(about .+\), so it may be chance\.$/);
    expect(ins.cards.filter((c) => c.waiting).every((c) => c.caveat === null)).toBe(true);
  });
});

describe("a waiting card's words", () => {
  it('splits the door\'s words from the sentence on what it counts', () => {
    const w = ins.cards.find((c) => c.waiting)!;
    const p = waitParts(w.wait_text);
    expect(p.head).toMatch(/^Not enough days yet: 0 for .* each needs 4\.$/);
    expect(p.counts).toBe(`It counts ${w.needs}.`);
    expect(`${p.head} ${p.counts}`).toBe(w.wait_text);
  });

  it('keeps all of it as one when there is no such sentence', () => {
    expect(waitParts('Not enough days yet.')).toEqual({ head: 'Not enough days yet.', counts: null });
    expect(waitParts(null)).toEqual({ head: '', counts: null });
  });
});
