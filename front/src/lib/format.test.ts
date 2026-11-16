import { describe, expect, it } from 'vitest';
import { dayLine } from './format.js';

describe('dayLine', () => {
  it('is the weekday and dd.mm. in Berlin', () => {
    expect(dayLine(new Date('2026-11-16T10:00:00Z'))).toBe('Mon 16.11.');
  });
  it("follows Berlin's midnight, not UTC's", () => {
    expect(dayLine(new Date('2026-11-16T23:30:00Z'))).toBe('Tue 17.11.');
    expect(dayLine(new Date('2026-07-31T22:30:00Z'))).toBe('Sat 01.08.');
  });
});
