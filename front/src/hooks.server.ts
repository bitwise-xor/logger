import type { Handle } from '@sveltejs/kit/hooks';
import { hubOrigin } from '#lib/server/config.js';
import { setFrameHeaders } from '#lib/server/frame.js';
import { sessionOf } from '#lib/server/session.js';

/** The session cookie for every request, and the headers SvelteKit does not set itself. The CSP comes from vite.config.ts. */
export const handle: Handle = async ({ event, resolve }) => {
  event.locals.session = sessionOf(event.cookies);
  const response = await resolve(event);
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'same-origin');
  // The signed-in pages may be shown in the hub's frame, nothing else (20.11.2026, frame.ts): the CSP's frame-ancestors and
  // X-Frame-Options.
  setFrameHeaders(response.headers, event.route.id, hubOrigin);
  // The scan sheet's camera and the logging box's microphone (deploy 90): this origin only, nothing else asks for them.
  response.headers.set('Permissions-Policy', 'camera=(self), microphone=(self)');
  // Nothing of a signed-in page is kept by the browser or anything in between.
  if (!response.headers.has('Cache-Control')) response.headers.set('Cache-Control', 'no-store');
  return response;
};
