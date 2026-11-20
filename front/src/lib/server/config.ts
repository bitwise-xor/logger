/** Settings from the container's environment (src/env.ts, compose.yaml), read once. */
import { APP_URL, DOOR_URL, FRONT_TOKEN, HUB_ORIGIN } from '$app/env/private';
import { makeDoor } from './door.js';
import { hubOriginOf } from './frame.js';

export const door = makeDoor({ url: DOOR_URL, token: FRONT_TOKEN });

/** The full web app, for everything this trial does not have yet. */
export const appUrl = APP_URL.replace(/\/+$/, '');

/** The hub, which may show the signed-in pages in a frame (frame.ts, 20.11.2026). */
export const hubOrigin = hubOriginOf(HUB_ORIGIN);
