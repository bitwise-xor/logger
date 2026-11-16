import type { Handle } from '@sveltejs/kit/hooks';
import { sessionOf } from '#lib/server/session.js';

/** The session cookie for every request, and the headers SvelteKit does not set itself. The CSP comes from vite.config.ts. */
export const handle: Handle = async ({ event, resolve }) => {
  event.locals.session = sessionOf(event.cookies);
  const response = await resolve(event);
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'same-origin');
  response.headers.set('X-Frame-Options', 'DENY');
  // Nothing of a signed-in page is kept by the browser or anything in between.
  if (!response.headers.has('Cache-Control')) response.headers.set('Cache-Control', 'no-store');
  return response;
};
