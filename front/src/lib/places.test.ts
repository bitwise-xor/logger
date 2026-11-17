// The places (deploy 108): which tab a path lights, and where More's rows lead.
import { describe, expect, it } from 'vitest';
import { MORE_PLACES, morePlaceHref, placeOf, SPACES, WORDS } from './places.js';

describe('placeOf', () => {
  it('lights More on its page and on Search, Recent, Usage and Coach, the rail too', () => {
    for (const p of ['/more', '/search', '/recent', '/usage', '/coach', '/coach/status']) expect(placeOf(p)).toEqual({ tab: 'more', space: null, atMore: true });
  });

  it('keeps the tabs and the Spaces as they were', () => {
    expect(placeOf('/')).toMatchObject({ tab: 'today' });
    expect(placeOf('/food')).toMatchObject({ tab: 'today' });
    expect(placeOf('/trends/charts')).toMatchObject({ tab: 'trends' });
    expect(placeOf('/library/usual')).toMatchObject({ tab: 'library' });
    expect(placeOf('/medical/tests')).toEqual({ tab: 'more', space: 'medical', atMore: false });
    expect(placeOf('/gym/history')).toEqual({ tab: 'more', space: 'gym', atMore: false });
    expect(placeOf('/searching')).toEqual({ tab: null, space: null, atMore: false });
    expect(SPACES.every((s) => s.href)).toBe(true);
  });
});

describe('More’s rows', () => {
  it('are Coach, Recent, Usage and Settings, in that order', () => {
    expect(MORE_PLACES.map((p) => p.name)).toEqual(['Coach', 'Recent', 'Usage', 'Settings']);
  });

  it('open their page here, or app.’s while they have none (Settings until deploy 111)', () => {
    const at = (k: string) => morePlaceHref(MORE_PLACES.find((p) => p.key === k)!, 'https://app.example.org');
    expect(at('recent')).toBe('/recent');
    expect(at('usage')).toBe('/usage');
    expect(at('coach')).toBe('/coach');
    expect(at('settings')).toBe('https://app.example.org/web/settings');
  });

  it('keep the Words at app.', () => {
    expect(WORDS.map((w) => w.app)).toEqual(['/web/ideas', '/web/private', '/web/gratitude']);
  });
});
