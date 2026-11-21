/**
 * Plain messages when the door cannot be asked (step F, deploy 85): what went wrong, said the same way on every page, on the
 * sign-in page and in a save's "Not saved." bar. Plain TypeScript with no SvelteKit import: the server decides the kind from the
 * door client's error (src/lib/server/door.ts), the pages only draw it.
 *
 * - signed out: the session is gone (the door's 401 `signed_out`): back to the sign-in page, nothing to say here;
 * - door off: the door answers 404 `not_found` to everything (FRONT_TOKEN unset at the core), or this app has no token itself
 *   (`door_off`). app. still works, so the message links there. The session cookie is kept: when the door is on again, so is the page;
 * - core down: the core does not answer at all (`unreachable`: stopped or restarting, nothing reached it; `no_answer`: a timeout or
 *   a connection dropped after the call went out). app. is the same core, so it is most likely down too: the message says to try
 *   again in a minute. A save that got no answer may have been saved all the same: it says so (`unsureText`, Web 65);
 * - trouble: anything else (the door's `server_error`, an answer this app cannot read).
 */

export type ProblemKind = 'door_off' | 'core_down' | 'trouble';
export type Where = 'page' | 'save' | 'signin';

/** The kind of a door error (a DoorError's code and status), or 'signed_out'. */
export function problemOf(error: unknown): ProblemKind | 'signed_out' {
  const e = (error ?? {}) as { code?: unknown; status?: unknown };
  const code = typeof e.code === 'string' ? e.code : '';
  if (code === 'signed_out') return 'signed_out';
  // The door's own 404 is always `not_found` (a missing entry is `no_entry`); a bare 404 without the door's body is the same gate.
  if (code === 'not_found' || code === 'door_off' || (e.status === 404 && code !== 'no_entry')) return 'door_off';
  if (code === 'unreachable' || code === 'no_answer') return 'core_down';
  return 'trouble';
}

const TEXT: Record<ProblemKind, Record<Where, string>> = {
  door_off: {
    page: 'The new front end is switched off right now. Everything is in the full app.',
    save: 'The new front end is switched off right now. Nothing was saved; the full app still works.',
    signin: 'The new front end is switched off right now. Sign in at the full app instead.',
  },
  core_down: {
    page: 'Logger is not answering right now, so the full app is most likely down too. Try again in a minute.',
    save: 'Logger is not answering right now. Nothing was saved; try again in a minute.',
    signin: 'Logger is not answering right now, so you cannot sign in. Try again in a minute.',
  },
  trouble: {
    page: 'Logger could not read this just now. Try again in a minute, or use the full app.',
    save: 'Logger could not save this just now. Nothing was saved; try again in a minute.',
    signin: 'Logger could not sign you in just now. Try again in a minute.',
  },
};

export function problemText(kind: ProblemKind, where: Where): string {
  return TEXT[kind][where];
}

/** Whether a link to app. helps: not when the core is down, since app. is the same core. */
export const linksToApp = (kind: ProblemKind) => kind !== 'core_down';

/**
 * The keyed saves whose key does not make a second send harmless (checked against the core on 21.11.2026, Web 65): a Habits page's
 * day tap toggles (sent again after it went through, it takes the tick back), the Habits list's forms take no key at the core, and
 * a habit's untick takes none either. Every other keyed save sent again with its key gets the first answer back (`replayed`) or a
 * refusal that changes nothing ("Nothing changed.", "no longer waiting").
 */
const NO_REPLAY = new Set(['habit_day', 'habits_manage']);
export const replays = (keyed: boolean, action: string, untick = false) => keyed && !NO_REPLAY.has(action) && !(action === 'habit' && untick);

/**
 * A save that went out and got no answer (Web 65, 21.11.2026: the door did not answer in time, or the browser heard nothing back):
 * the core may have saved it. safe: the save goes with a key the core replays (`replays`), and the same tap sent again within 10
 * minutes keeps that key, so the door answers with the first answer instead of saving twice (src/lib/saver.ts); otherwise the page
 * has to be looked at first.
 */
export function unsureText(safe: boolean): string {
  return safe
    ? 'No answer from Logger in time (weak connection?). It may have been saved: try again, it will not be saved twice.'
    : 'No answer from Logger in time (weak connection?). It may have been saved: reload the page to look before you try again.';
}
