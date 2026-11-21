// The error pages' words (Web 66): plain, by status only.
import { describe, expect, it } from 'vitest';
import { errorWords } from './errorpage.js';

describe('errorWords', () => {
  it('says "not found" for a 404 and "something went wrong" for everything else', () => {
    expect(errorWords(404).title).toBe('Not found');
    for (const s of [400, 403, 500, 502, 503]) expect(errorWords(s).title, String(s)).toBe('Something went wrong');
    expect(errorWords(500).text).toMatch(/Try again, or go back to Today/);
  });
});
