// The hub's frame (20.11.2026): which answers it may show, and the headers each gets.
import { describe, expect, it } from 'vitest';
import { framable, hubOriginOf, setFrameHeaders } from './frame.js';

const HUB = 'https://hub.19hospitalroad.fyi';
// the policy as SvelteKit sends it from vite.config.ts (a part of it)
const CSP = "default-src 'self'; script-src 'self' 'nonce-abc'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'";

function answer(routeId: string | null, csp: string | null = CSP) {
  const headers = new Headers();
  if (csp) headers.set('content-security-policy', csp);
  setFrameHeaders(headers, routeId, HUB);
  return headers;
}

describe('framable', () => {
  it('lets the hub frame the signed-in pages', () => {
    for (const id of ['/(app)', '/(app)/food', '/(app)/health', '/(app)/habits', '/(app)/gym/plan', '/(app)/home/pick', '/(app)/trends',
      '/(app)/library/usual', '/(app)/medical', '/(app)/more', '/(app)/coach', '/(app)/search', '/(app)/settingsx']) {
      expect(framable(id), id).toBe(true);
    }
  });
  it('keeps the sign-in, sign-out, Settings and everything else out of every frame', () => {
    for (const id of ['/login', '/(app)/signout', '/(app)/settings', '/(app)/settings/devices', '/(app)/settings/notifications',
      '/(app)/settings/export', '/(app)/[...rest]', '/', '/health', null, undefined, '']) {
      expect(framable(id), String(id)).toBe(false);
    }
  });
});

describe('setFrameHeaders', () => {
  it('a framed page allows this app and the hub, and has no X-Frame-Options', () => {
    const h = answer('/(app)');
    expect(h.get('content-security-policy')).toBe(CSP.replace("frame-ancestors 'none'", `frame-ancestors 'self' ${HUB}`));
    expect(h.has('x-frame-options')).toBe(false);
  });
  it('the sign-in and Settings still deny every frame', () => {
    for (const id of ['/login', '/(app)/settings/devices', '/(app)/signout', null]) {
      const h = answer(id);
      expect(h.get('content-security-policy'), String(id)).toBe(CSP);
      expect(h.get('x-frame-options'), String(id)).toBe('DENY');
    }
  });
  it('an answer without the policy (a JSON route, a redirect) denies frames too', () => {
    const h = answer('/(app)/food/entry', null);
    expect(h.get('x-frame-options')).toBe('DENY');
    expect(h.has('content-security-policy')).toBe(false);
  });
});

describe('hubOriginOf', () => {
  it('keeps scheme, host and port only', () => {
    expect(hubOriginOf(HUB)).toBe(HUB);
    expect(hubOriginOf(`${HUB}/`)).toBe(HUB);
    expect(hubOriginOf("https://hub.example.test:8443/x; script-src *")).toBe('https://hub.example.test:8443');
    expect(() => hubOriginOf('javascript:alert(1)')).toThrow();
    expect(() => hubOriginOf('not an address')).toThrow();
  });
});
