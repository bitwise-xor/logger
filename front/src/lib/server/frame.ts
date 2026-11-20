/**
 * Which answers the hub (the owner's home dashboard) may show in a frame (20.11.2026; it shows Today with ?compact=1,
 * static/theme.js). The signed-in pages may be framed by this app itself and by the hub; the sign-in, sign-out and Settings (it
 * signs out devices) never, nor anything else. The CSP of vite.config.ts says `frame-ancestors 'none'` for every page; for a
 * framed page hooks.server.ts swaps that for the hub, and leaves out X-Frame-Options (it cannot name an allowed page, and a
 * browser would block the frame for it). Every other answer gets X-Frame-Options DENY.
 */

/** May the page of this route (SvelteKit's route id, e.g. "/(app)/food") be shown in the hub's frame? */
export function framable(routeId: string | null | undefined): boolean {
  if (!routeId?.startsWith('/(app)')) return false; // the sign-in, an unknown address (no route), anything outside the signed-in pages
  const path = routeId.slice('/(app)'.length) || '/';
  return !/^\/(settings|signout)(\/|$)/.test(path);
}

/** The hub's origin from its setting (HUB_ORIGIN): scheme, host and port only, so nothing else can reach the CSP. */
export function hubOriginOf(value: string): string {
  const url = new URL(value);
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error('HUB_ORIGIN must be an http(s) address');
  return url.origin;
}

/** Sets the frame headers of one answer, in place. */
export function setFrameHeaders(headers: Headers, routeId: string | null | undefined, hubOrigin: string): void {
  const csp = headers.get('content-security-policy');
  if (framable(routeId) && csp?.includes("frame-ancestors 'none'")) {
    headers.set('content-security-policy', csp.replace("frame-ancestors 'none'", `frame-ancestors 'self' ${hubOrigin}`));
    headers.delete('x-frame-options');
  } else {
    headers.set('x-frame-options', 'DENY');
  }
}
