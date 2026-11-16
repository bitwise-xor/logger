/**
 * After the sign-in, back to the page you were on (step F): the sign-in page gets `?next=/food?day=…` and goes there afterwards.
 * Only a path of this app is taken, never another site: it must start with one "/", hold no backslash, space or control
 * character, and stay on this origin once read as a URL. Anything else, and the sign-in and sign-out pages, become Today ("/").
 */

const MAX = 300;

export function safeNext(raw: string | null | undefined): string {
  if (typeof raw !== 'string' || raw.length > MAX) return '/';
  // "//host" and "/\host" are other sites to a browser; no spaces or control characters either.
  if (!raw.startsWith('/') || raw.startsWith('//') || /[\\\s\u0000-\u001f\u007f]/.test(raw)) return '/';
  let url: URL;
  try {
    url = new URL(raw, 'http://here.invalid');
  } catch {
    return '/';
  }
  if (url.origin !== 'http://here.invalid') return '/';
  if (/^\/(login|signout)(\/|$)/.test(url.pathname)) return '/';
  return url.pathname + url.search;
}

/** The sign-in page's address for a page of this app (Today needs no `next`). */
export function loginHref(pathAndSearch: string): string {
  const next = safeNext(pathAndSearch);
  return next === '/' ? '/login' : `/login?next=${encodeURIComponent(next)}`;
}
