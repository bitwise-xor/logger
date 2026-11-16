/**
 * The scan sheet's routes (deploy 90, src/routes/(app)/scan/…): the browser asks this app, this app asks the door (GET
 * /foods/barcode, /foods/off, POST /food/label; docs/API.md). Their answers go to the browser as the door sent them; a problem
 * as {error, message} with plain words, so the sheet can say why. The photos pass through in memory and are not kept.
 */
import { json } from '@sveltejs/kit';
import { DoorError } from './door.js';
import { problemOf, problemText } from '../problems.js';
import { MAX_PHOTOS, MAX_PHOTO_BYTES, TOO_LARGE } from '../scan.js';

const NO_STORE = { 'cache-control': 'no-store' };

export const signedOut = () => json({ error: 'signed_out', message: 'Sign in again.' }, { status: 401, headers: NO_STORE });
export const answer = (body: unknown) => json(body, { headers: NO_STORE });

/** A door problem in plain words: the door off or the core down as on a save (problems.ts), else the door's own message. */
export function failure(error: unknown) {
  const kind = problemOf(error);
  if (kind === 'signed_out') return signedOut();
  if (kind === 'door_off' || kind === 'core_down') {
    return json({ error: kind, message: problemText(kind, 'save').replace(' Nothing was saved;', ';') }, { status: 503, headers: NO_STORE });
  }
  if (error instanceof DoorError) {
    return json({ error: error.code, message: error.message }, { status: error.status || 502, headers: NO_STORE });
  }
  return json({ error: 'server_error', message: 'That did not work; try again in a moment.' }, { status: 500, headers: NO_STORE });
}

const TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

/**
 * The label photos of the browser's form (the field `photo`, one to three), checked as the door checks them, so a wrong one is
 * said at once and nothing goes on: a form for the door, or the words why not.
 */
export function photoForm(got: FormData): { form: FormData } | { status: number; message: string } {
  const photos = got.getAll('photo').filter((p): p is File => typeof p !== 'string');
  if (!photos.length) return { status: 400, message: 'No photo came with the request.' };
  if (photos.length > MAX_PHOTOS) return { status: 400, message: `At most ${MAX_PHOTOS} photos.` };
  const form = new FormData();
  for (const p of photos) {
    if (!TYPES.has(p.type)) return { status: 400, message: 'A photo must be JPEG, PNG, WebP or GIF.' };
    if (p.size === 0) return { status: 400, message: 'A photo is empty.' };
    if (p.size > MAX_PHOTO_BYTES) return { status: 413, message: TOO_LARGE };
    form.append('photo', p, p.type === 'image/jpeg' ? 'label.jpg' : `label.${p.type.slice(6)}`);
  }
  return { form };
}
