// Reading the page again when the app comes back (Web 67): after a minute away, and never over a save on its way or typed words.
import { describe, expect, it } from 'vitest';
import { AWAY_MS, Comeback, type Probe } from './comeback.js';

const calm: Probe = { inFlight: () => 0, focused: () => false, typed: () => false, open: () => false };

describe('Comeback', () => {
  it('reads again after a minute or more away, not sooner, and only once per absence', () => {
    let now = 0;
    const c = new Comeback(() => now);
    expect(c.visible(calm)).toBe(false); // never hidden
    c.hidden();
    now += AWAY_MS - 1;
    expect(c.visible(calm)).toBe(false);
    c.hidden();
    now += AWAY_MS;
    expect(c.visible(calm)).toBe(true);
    expect(c.visible(calm)).toBe(false); // the same return again
  });

  it('counts the absence from the first time the page was hidden', () => {
    let now = 0;
    const c = new Comeback(() => now);
    c.hidden();
    now += 40_000;
    c.hidden(); // hidden again without a return in between
    now += 30_000;
    expect(c.visible(calm)).toBe(true);
  });

  it('waits while a save is on its way, a field has the focus, words were typed or something is open, and tries at the next return', () => {
    for (const held of ['inFlight', 'focused', 'typed', 'open'] as const) {
      let now = 0;
      const c = new Comeback(() => now);
      const probe: Probe = { ...calm, [held]: held === 'inFlight' ? () => 1 : () => true };
      c.hidden();
      now += 5 * AWAY_MS;
      expect(c.visible(probe), held).toBe(false);
      c.hidden();
      now += 1000; // a short absence, but the long one is still owed
      expect(c.visible(calm), held).toBe(true);
    }
  });
});
