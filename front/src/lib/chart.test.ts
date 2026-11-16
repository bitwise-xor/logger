// The chart part's geometry (deploy 92): app.'s drawChart as plain functions, against its own rules and the door's real chart
// descriptions (tests/samples/health.json).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { chartLayout, clockLayout, dateAt, HEIGHT, MIN_WIDTH, nearestHit, niceTicks, tipBox, type ChartData } from './chart.js';
import type { Body, Health } from './health.js';

const SAMPLE = JSON.parse(readFileSync(new URL('../../tests/samples/health.json', import.meta.url), 'utf8'));
const health: Health = SAMPLE.health.health;
const body: Body = SAMPLE.body.body;
const chartOf = (id: string) => health.charts.find((c) => c.id === id)!.chart;

describe('niceTicks', () => {
  it('round steps of 1, 2, 2.5 or 5 times a power of ten, covering both ends', () => {
    expect(niceTicks(80.5, 81.6, 4)).toEqual([80.5, 81, 81.5, 82]);
    expect(niceTicks(0, 9.2, 4)).toEqual([0, 2.5, 5, 7.5, 10]);
    expect(niceTicks(1, 5, 4)).toEqual([1, 2, 3, 4, 5]);
    expect(niceTicks(70, 140, 4)).toEqual([60, 80, 100, 120, 140]);
  });

  it('one value: a step either side', () => {
    expect(niceTicks(92, 92, 4)).toEqual([91, 91.5, 92, 92.5, 93]);
  });
});

describe('dateAt', () => {
  it('counts days from the start, over a month and a year', () => {
    expect(dateAt('2026-10-18', 0)).toBe('18.10.');
    expect(dateAt('2026-10-18', 14)).toBe('01.11.');
    expect(dateAt('2026-12-30', 3, true)).toBe('02.01.27');
  });
});

describe('chartLayout', () => {
  it('draws nothing without a point', () => {
    expect(chartLayout({ start: '2026-11-01', days: 7, series: [{ mark: 'dot', cls: 'a', pts: [] }], label: 'x' }, 400)).toBeNull();
  });

  it('every point of the sample a mark, every series a line, in the order drawn', () => {
    for (const c of health.charts) {
      const l = chartLayout(c.chart, 400)!;
      for (const mark of ['dot', 'ring', 'bar'] as const) {
        const want = c.chart.series.filter((s) => s.mark === mark).reduce((a, s) => a + s.pts.length, 0);
        expect(l.shapes.filter((s) => s.kind === mark).length, `${c.id} ${mark}`).toBe(want);
      }
      expect(l.shapes.filter((s) => s.kind === 'line').length).toBe(c.chart.series.filter((s) => s.mark === 'line' && s.pts.length > 1).length);
      expect(l.hits.length).toBe(c.chart.series.flatMap((s) => s.pts).filter((p) => p[2]).length);
    }
    // the weight's average line is drawn under its dots
    expect(chartLayout(chartOf('weight'), 400)!.shapes[0]!.kind).toBe('line');
  });

  it('the scale: axis numbers with the decimals asked for, the unit, a fixed bottom and top', () => {
    expect(chartLayout(chartOf('weight'), 400)!.ticks.every((t) => /^\d+\.\d$/.test(t.text))).toBe(true);
    const sleep = chartLayout(chartOf('sleep'), 400)!;
    expect(sleep.ticks[0]!.text).toBe('0 h');
    const mood = chartLayout(chartOf('mood'), 400)!;
    expect(mood.ticks.map((t) => t.text)).toEqual(['1', '2', '3', '4', '5']);
    // the top tick at the top (8), the bottom one at the bottom (190 − 22)
    expect(mood.ticks[0]!.y).toBe(HEIGHT - 22);
    expect(mood.ticks[4]!.y).toBe(8);
  });

  it('the reference lines with their words, at their values', () => {
    const bp = chartLayout(chartOf('bp'), 400)!;
    expect(bp.refs.map((r) => [r.cls, r.text])).toEqual([['r', '140'], ['w', '130'], ['r', '90'], ['w', '80']]);
    expect(bp.refs[0]!.y).toBeLessThan(bp.refs[1]!.y);
  });

  it('the axis dates: first, middle and last (start, middle, end); every day in a week', () => {
    const w = chartLayout(chartOf('weight'), 400)!;
    expect(w.xLabels.map((l) => [l.text, l.anchor])).toEqual([['18.10.', 'start'], ['01.11.', 'middle'], ['16.11.', 'end']]);
    const week = chartLayout({ ...chartOf('weight'), days: 7 }, 400)!;
    expect(week.xLabels.length).toBe(7);
    expect(week.xLabels.every((l) => l.anchor === 'middle')).toBe(true);
  });

  it('x spans the width: the first day at the left edge, the last at the right; bars inset', () => {
    const w = chartLayout(chartOf('weight'), 500)!;
    expect(w.W).toBe(500);
    expect(w.xLabels[0]!.x).toBe(42);
    expect(w.xLabels[2]!.x).toBe(492);
    const sleep = chartLayout(chartOf('sleep'), 500)!;
    expect(sleep.xLabels[0]!.x).toBe(50);
  });

  it('never narrower than 260 (scaled down instead)', () => {
    expect(chartLayout(chartOf('weight'), 120)!.W).toBe(MIN_WIDTH);
    expect(chartLayout(chartOf('weight'), 0)!.W).toBe(MIN_WIDTH);
  });

  it('bars stand on the bottom of the scale, as tall as their value', () => {
    const sleep = chartLayout(chartOf('sleep'), 400)!;
    const bar = sleep.shapes.find((s) => s.kind === 'bar')!;
    if (bar.kind !== 'bar') throw new Error('a bar');
    expect(+(bar.y + bar.h).toFixed(1)).toBe(HEIGHT - 22);
  });

  it('stacked bars: a base lifts a bar; a band is shaded', () => {
    const o: ChartData = {
      start: '2026-11-01',
      days: 2,
      label: 'x',
      min: 0,
      band: [2, null],
      series: [{ mark: 'bar', cls: 'a', pts: [[0, 2, 'a', 0], [0, 3, 'b', 2]] }],
    };
    const l = chartLayout(o, 300)!;
    const [a, b] = l.shapes.filter((s) => s.kind === 'bar');
    if (a?.kind !== 'bar' || b?.kind !== 'bar') throw new Error('two bars');
    expect(+(b.y + b.h).toFixed(1)).toBe(a.y);
    expect(l.band).not.toBeNull();
  });

  it('the body charts: the value above each point, the points’ own dates on the axis', () => {
    const waist = body.charts.find((c) => c.key === 'waist')!.chart;
    const l = chartLayout(waist, 400)!;
    expect(l.shapes.filter((s) => s.kind === 'label').map((s) => (s.kind === 'label' ? s.text : ''))).toEqual(['94.0', '93.0', '92.0']);
    expect(l.xLabels.map((x) => x.text)).toEqual(['17.09.', '15.10.', '12.11.']);
    // one session: one point in the middle
    const arm = chartLayout(body.charts.find((c) => c.key === 'upper_arm')!.chart, 400)!;
    expect(arm.xLabels).toEqual([{ x: +(42 + 0.5 * (400 - 50)).toFixed(1), text: '17.09.', anchor: 'middle' }]);
  });
});

describe('a tap', () => {
  const l = chartLayout(chartOf('sugar'), 400)!;
  it('hits the nearest mark within reach, or nothing', () => {
    const m = l.hits[1]!;
    expect(nearestHit(l.hits, m.x + 3, m.y - 4, l.bw)).toBe(m);
    expect(nearestHit(l.hits, m.x, m.y - 40, l.bw)).toBeNull();
  });

  it('a bar at any height', () => {
    const s = chartLayout(chartOf('sleep'), 400)!;
    const m = s.hits.find((h) => h.bar)!;
    expect(nearestHit(s.hits, m.x + 1, 180, s.bw)).toBe(m);
  });

  it('its box above the mark, below it at the top, never past the sides', () => {
    expect(tipBox({ x: 200, y: 100, t: 'abc', bar: false }, 400)).toEqual({ x: 200 - (3 * 6.3 + 14) / 2, y: 72, w: 3 * 6.3 + 14, h: 20 });
    expect(tipBox({ x: 200, y: 10, t: 'abc', bar: false }, 400).y).toBe(20);
    expect(tipBox({ x: 395, y: 100, t: 'a long text here', bar: false }, 400).x).toBe(400 - (16 * 6.3 + 14) - 2);
    expect(tipBox({ x: 1, y: 100, t: 'abc', bar: false }, 400).x).toBe(2);
  });
});

describe('the clock rows', () => {
  it('a row per date, bands and ticks across 0 to 24 h', () => {
    const l = clockLayout(health.times);
    expect(l.rows.length).toBe(health.times.rows.length);
    expect(l.grid.map((g) => [g.x, g.text])).toEqual([[40, '00'], [120, '06'], [200, '12'], [280, '18'], [360, '24']]);
    const first = l.rows[0]!;
    expect(first.bands[0]).toMatchObject({ x: 40, w: +((320 * 439) / 1440).toFixed(1) });
    expect(l.H).toBe(16 + health.times.rows.length * 13 + 4);
    expect(l.rows.filter((r) => r.label).length).toBe(health.times.rows.filter((r) => r.label).length);
  });

  it('a band of a minute is still seen; a tick spans its row', () => {
    const l = clockLayout({ days: 1, empty: false, rows: [{ date: '2026-11-16', label: '16.11.', bands: [{ from: 600, to: 600, nap: true, tip: 'x' }], ticks: [{ at: 360, nap: false, tip: 'y' }] }] });
    expect(l.rows[0]!.bands[0]!.w).toBe(1.5);
    expect(l.rows[0]!.ticks[0]).toMatchObject({ x: 120, y1: 17, y2: 28 });
  });
});
