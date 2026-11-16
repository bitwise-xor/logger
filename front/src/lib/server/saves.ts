/**
 * Today's saves (step C, deploy 80; the logging box's typed line since step D, deploy 81) and the Food day's (step E, deploy 84):
 * which form action calls which door route with which body (docs/API.md, "Saves").
 *
 * Every tap on Today is a SvelteKit form action (src/routes/(app)/+page.server.ts). The browser sends the form's fields and a
 * new `key` per tap (the same key again when it re-sends that tap after a sign-in, src/lib/saver.ts); this file turns the fields
 * into the door's JSON body, adds the key where the door's route takes one, and asks for the fresh day in the answer
 * (`view: "day"`, or `view: "food"` with the day shown for the Food day), so the page can replace what it shows without a reload.
 *
 * Plain TypeScript with no SvelteKit import, so the tests can hand it a door with a fake network.
 */
import type { Door } from './door.js';
import { DoorError } from './door.js';

/** The form's fields: what `FormData` offers (and a plain test double). */
export interface Fields {
  get(name: string): FormDataEntryValue | null;
  getAll(name: string): FormDataEntryValue[];
}

type Body = Record<string, unknown>;

interface Save {
  path: string;
  /** The door's route takes a re-send key (docs/API.md): a re-sent tap then saves once. */
  keyed: boolean;
  body: (f: Fields) => Body;
  /** /log and /held/retry read the words with the AI: up to about 40 s. */
  timeoutMs?: number;
}

const str = (f: Fields, name: string, limit = 200): string | undefined => {
  const v = f.get(name);
  if (typeof v !== 'string') return undefined;
  const t = v.trim().slice(0, limit);
  return t === '' ? undefined : t;
};

/** A whole number, or left out (the door then says what is missing or wrong). */
const int = (f: Fields, name: string): number | undefined => {
  const t = str(f, name, 20);
  return t !== undefined && /^\d{1,12}$/.test(t) ? Number(t) : undefined;
};

export const SAVES = {
  // A typed line, as many lines as the box holds (each can be its own entry); 4000 characters as app.'s box (webentry.MAX_TEXT).
  log: { path: '/log', keyed: true, body: (f) => ({ text: str(f, 'text', 4000) }), timeoutMs: 60_000 },
  water: { path: '/water', keyed: true, body: (f) => ({ ml: int(f, 'ml') }) },
  again: { path: '/again', keyed: true, body: (f) => ({ food_id: str(f, 'food_id', 12), amount: str(f, 'amount', 20) }) },
  usual: { path: '/usual', keyed: true, body: (f) => ({ meal_id: str(f, 'meal_id', 12) }) },
  habit: {
    path: '/habit',
    keyed: true,
    body: (f) => ({ name: str(f, 'name', 64), action: str(f, 'action', 10), ref: str(f, 'ref', 20) }),
  },
  checkin: {
    path: '/checkin',
    keyed: true,
    body: (f) => ({ type: str(f, 'type', 10), value: str(f, 'value', 3), day: str(f, 'day', 10) }),
  },
  health: {
    path: '/health',
    keyed: true,
    body: (f) => ({
      row: str(f, 'row', 20),
      ref: str(f, 'ref', 20),
      v1: str(f, 'v1', 20),
      v2: str(f, 'v2', 20),
      time: str(f, 'time', 5),
      confirmed: f.get('confirmed') === '1' ? true : undefined,
    }),
  },
  answer: { path: '/answer', keyed: false, body: (f) => ({ question_id: str(f, 'question_id', 64), reply: str(f, 'reply', 2000) }) },
  review: {
    path: '/review',
    keyed: false,
    body: (f) =>
      str(f, 'action', 5) === 'all'
        ? { action: 'all', refs: f.getAll('refs').filter((r): r is string => typeof r === 'string').slice(0, 200) }
        : { action: str(f, 'action', 5), ref: str(f, 'ref', 20) },
  },
  held_retry: { path: '/held/retry', keyed: true, body: (f) => ({ id: int(f, 'id') }), timeoutMs: 60_000 },
  held_delete: { path: '/held/delete', keyed: true, body: (f) => ({ id: int(f, 'id') }) },
  undo: { path: '/undo', keyed: false, body: (f) => ({ token: str(f, 'token', 200) }) },
  // The Food day (step E): change a row (amount in a unit, time hh:mm, another food by its name) or delete it; an odd value is
  // read back first (then the same with confirmed). The door's routes take no key: a change made twice is caught as on app.
  food_entry: {
    path: '/food/entry',
    keyed: false,
    body: (f) => ({
      ref: str(f, 'ref', 12),
      action: str(f, 'action', 10),
      amount: str(f, 'amount', 20),
      unit: str(f, 'unit', 40),
      time: str(f, 'time', 5),
      food_name: str(f, 'food_name', 200),
      confirmed: f.get('confirmed') === '1' ? true : undefined,
    }),
  },
  // A row's note; empty removes it (300 characters, as app.).
  food_note: { path: '/food/note', keyed: false, body: (f) => ({ ref: str(f, 'ref', 12), note: str(f, 'note', 300) ?? '' }) },
} satisfies Record<string, Save>;

export type SaveName = keyof typeof SAVES;
export const SAVE_NAMES = Object.keys(SAVES) as SaveName[];
/** The Food day's form actions (src/routes/(app)/food); Today has all the others. */
export const FOOD_SAVES: SaveName[] = ['food_entry', 'food_note', 'undo'];
export const TODAY_SAVES: SaveName[] = SAVE_NAMES.filter((n) => n !== 'food_entry' && n !== 'food_note');
export type View = 'day' | 'food';

/** A key as the browser makes them (src/lib/saver.ts): a random UUID or base64url; anything else is replaced. */
const KEY = /^[A-Za-z0-9_-]{16,64}$/;

/** The door's body for a save: the form's fields, the key where the route takes one, and the fresh Today (or Food day) in the answer. */
export function bodyFor(
  name: SaveName,
  f: Fields,
  viewDay: string | undefined,
  newKey: () => string = () => crypto.randomUUID(),
  view: View = 'day',
): Body {
  const save: Save = SAVES[name];
  const body: Body = { ...save.body(f), view };
  if (viewDay && /^\d{4}-\d\d-\d\d$/.test(viewDay)) body.view_day = viewDay;
  if (save.keyed) {
    const key = str(f, 'key', 64);
    // A form sent without the page's script has no key: one is made here (a re-send of that form is then a new save).
    body.key = key && KEY.test(key) ? key : newKey();
  }
  for (const k of Object.keys(body)) if (body[k] === undefined) delete body[k];
  return body;
}

export type SaveResult<A> =
  | { ok: true; answer: A; expiresAt: string | null }
  | { ok: false; status: number; signedOut: boolean; message: string };

/** One save through the door. Signed out (or the door switched off): signedOut, so the page can keep the tap and sign in. */
export async function runSave<A>(
  door: Door,
  session: string,
  name: SaveName,
  f: Fields,
  viewDay?: string,
  view: View = 'day',
): Promise<SaveResult<A>> {
  const save: Save = SAVES[name];
  try {
    const { body, expiresAt } = await door.post<A>(save.path, session, bodyFor(name, f, viewDay, undefined, view), save.timeoutMs);
    return { ok: true, answer: body, expiresAt };
  } catch (error) {
    if (error instanceof DoorError) {
      const signedOut = ['signed_out', 'not_found', 'door_off'].includes(error.code);
      return { ok: false, status: signedOut ? 401 : error.status || 502, signedOut, message: error.message };
    }
    return { ok: false, status: 500, signedOut: false, message: 'Something went wrong. Nothing was saved.' };
  }
}
