import { describe, expect, it } from 'vitest';
import { dayLine, dayOf, hm, hours, n, pct, plain, roundHalfEven } from './format.js';

describe('dayLine', () => {
  it('is the weekday and dd.mm. in Berlin', () => {
    expect(dayLine(new Date('2026-11-16T10:00:00Z'))).toBe('Mon 16.11.');
  });
  it("follows Berlin's midnight, not UTC's", () => {
    expect(dayLine(new Date('2026-11-16T23:30:00Z'))).toBe('Tue 17.11.');
    expect(dayLine(new Date('2026-07-31T22:30:00Z'))).toBe('Sat 01.08.');
  });
  it('reads a logging day as the door sends it', () => {
    expect(dayOf('2026-11-16')).toBe('Mon 16.11.');
    expect(dayOf('2026-03-29')).toBe('Sun 29.03.'); // the night the clocks change
  });
});

describe('hm', () => {
  it("is the Berlin clock time of the door's ISO times", () => {
    expect(hm('2026-11-16T05:40:00+01:00')).toBe('05:40');
    expect(hm('2026-07-01T23:05:00+02:00')).toBe('23:05');
    expect(hm('2026-11-16T04:40:00Z')).toBe('05:40');
  });
  it('is empty for no time', () => {
    expect(hm(null)).toBe('');
    expect(hm('')).toBe('');
    expect(hm('not a time')).toBe('');
  });
});

describe('n: numbers as app. shows them', () => {
  it('rounds halves to even, as Python does', () => {
    expect(roundHalfEven(700.5)).toBe(700);
    expect(roundHalfEven(701.5)).toBe(702);
    expect(roundHalfEven(1399.5)).toBe(1400);
    expect(roundHalfEven(0.25, 1)).toBe(0.2);
    expect(n(700.5)).toBe('700');
    expect(n(2.5)).toBe('2');
  });
  it('groups thousands with a comma', () => {
    expect(n(2100)).toBe('2,100');
    expect(n(1234567.4)).toBe('1,234,567');
    expect(n(182.4, 1)).toBe('182.4');
  });
  it('writes a dash for nothing, and no minus zero', () => {
    expect(n(null)).toBe('–');
    expect(n(undefined)).toBe('–');
    expect(n(-0.4)).toBe('0');
  });
  it('keeps typed values plain', () => {
    expect(plain(82.4)).toBe('82.4');
    expect(plain(118)).toBe('118');
    expect(plain(null)).toBe('');
  });
});

describe('hours and bars', () => {
  it('writes a length of time as app. does', () => {
    expect(hours(440)).toBe('7 h 20 min');
    expect(hours(65)).toBe('1 h 05 min');
  });
  it('fills a bar from 0 to 100, empty without a target', () => {
    expect(pct(750, 3000)).toBe(25);
    expect(pct(4000, 3000)).toBe(100);
    expect(pct(10, null)).toBe(0);
    expect(pct(-5, 100)).toBe(0);
  });
});
