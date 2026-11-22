/**
 * Saving in place (step C, deploy 80), in the browser: a tap posts its form to the page's form action (`/?/water`, …) and the
 * answer's fresh day replaces what is on screen, with no reload (the plan, "Saving in place").
 *
 * - The key rule: every tap gets a new `key`; the same tap sent again (after a sign-in) keeps its key, so the door saves it once.
 * - Newest answer wins: when two saves overlap, an answer that comes back after a newer one's is dropped (its day is older).
 *   Not a typed line's (step D, deploy 81): the AI reads it for up to 40 s, and its day is read only after that, so it is newer
 *   than that of a tap made meanwhile (SLOW).
 * - Signed out mid-save: the tap and its key are kept in the tab's sessionStorage; after the sign-in Today sends it again
 *   (only a tap the door can tell apart by its key, and only within 10 minutes).
 * - No answer (Web 65, 21.11.2026): a send that went out and heard nothing back (the browser's wait of WAIT_MS ran out, the network
 *   dropped, or the server says the door did not answer in time) may have been saved. Its key is remembered for 10 minutes with the
 *   action and a fingerprint of its fields (never the words: sessionStorage); the same tap sent again in that time goes with the
 *   same key, so the door answers with the first answer instead of saving twice (or refuses without a change: held lines, a day's
 *   health values). Not for a Habits page's day tap, its list forms or an untick, which the core does not replay (problems.ts,
 *   `replays`): their words say to look first. Any answer of the door ends that. The words say
 *   "may have been saved", and "Nothing was saved" only where that is certain (the phone was offline before the send, or the door
 *   answered with an error).
 *
 * Plain TypeScript: the network, SvelteKit's `deserialize` and the storage are handed in, so the tests can fake them.
 */

import { replays, unsureText } from './problems.js';
import { LONG_WAIT_MS, ruleOf, savesWhere, WAIT_MS } from './saverules.js';

/** What SvelteKit's `deserialize` gives back for a form action (an ActionResult). */
export type ActionResult =
  | { type: 'success'; status: number; data?: Record<string, unknown> }
  | { type: 'failure'; status: number; data?: Record<string, unknown> }
  | { type: 'redirect'; status: number; location: string }
  | { type: 'error'; status?: number; error: unknown };

export type Sent<A> =
  | { kind: 'answer'; answer: A }
  /** A newer save's answer came first: this one is dropped. */
  | { kind: 'stale' }
  /** The session is gone: the tap is kept for after the sign-in (when it can be re-sent). */
  | { kind: 'signed_out' }
  | { kind: 'problem'; message: string; link?: string | null };

export type FieldValues = Record<string, string | string[]>;

export interface SaverDeps {
  fetch: (url: string, init: RequestInit) => Promise<Response>;
  deserialize: (text: string) => ActionResult;
  storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null;
  newKey?: () => string;
  now?: () => number;
  /** The page whose actions are called: "/" (Today). */
  page?: string;
  /** Whether the browser says it is online (navigator.onLine); offline before a send means nothing went out. */
  online?: () => boolean;
}

/**
 * The browser's lists, all made from the one table of how each save behaves (src/lib/saverules.ts, web item 72): the actions that
 * go with a key; the keyed ones never sent again by the page (a Habits page's day tap, the Gym's tick, Home's keyed saves: the table
 * says why); whether a tap that met a gone session is kept and sent again after the sign-in (only a keyed one the table marks
 * `resend`; an unknown action never); the paid coaching starts with their own "no answer" words; how long the browser waits.
 */
export const KEYED: ReadonlySet<string> = new Set(savesWhere((r) => r.key !== 'none'));
export const NEVER_RESENT: ReadonlySet<string> = new Set(savesWhere((r) => r.key !== 'none' && !r.resend));
export const mayResend = (action: string) => ruleOf(action)?.resend === true;
/** A paid start that may have gone through although no answer came: its own words (reload to see before pressing again). */
const UNSURE: ReadonlySet<string> = new Set(savesWhere((r) => r.coaching === true));
export { LONG_WAIT_MS, WAIT_MS };
export const waitMs = (action: string) => (ruleOf(action)?.long ? LONG_WAIT_MS : WAIT_MS);
/** The keys of keyed taps that got no answer (Web 65): sessionStorage, 10 minutes. */
export const UNANSWERED_ITEM = 'logger-unanswered';
export const UNANSWERED_MS = 10 * 60_000;
/** The actions the AI reads (up to about 40 s; the look-up since deploy 90): their answer is never dropped for a tap made while they were read. */
export const SLOW: ReadonlySet<string> = new Set(savesWhere((r) => r.slow === true));
export const RESEND_ITEM = 'logger-resend';
export const RESEND_MS = 10 * 60_000;

export function makeKey(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(18));
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
}

/** A keyed tap that got no answer: its action, a fingerprint of its page and fields (not the fields), its key and when. */
interface Unanswered {
  action: string;
  print: string;
  key: string;
  at: number;
}

/**
 * A short fingerprint of a tap: the page, the action and its fields without the key, in a fixed order (cyrb53, a plain 53-bit
 * hash: enough to tell taps apart, and the words of a typed line are not kept).
 */
export function fingerprint(page: string, action: string, fields: FieldValues): string {
  const plain = Object.keys(fields)
    .filter((k) => k !== 'key')
    .sort()
    .map((k) => [k, fields[k]]);
  const text = JSON.stringify([page, action, plain]);
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

/** The words when it is not known whether a save arrived (the server says the same for its own wait: problems.ts, unsureText). */
export function noAnswerText(action: string, fields: FieldValues = {}): string {
  if (UNSURE.has(action)) return 'No answer from Logger (offline?). The coaching may have started anyway: reload the page to see before you press again.';
  return unsureText(replays(KEYED.has(action), action, fields.action === 'untick'));
}

export interface Kept {
  action: string;
  fields: FieldValues;
  at: number;
  /** The page whose form action it is (deploy 87; none: Today, "/"): only that page sends it again. */
  page?: string;
}

/** Saves on their way in this tab, of every Saver (Web 67: the page is not read again meanwhile, src/lib/comeback.ts). */
let inFlight = 0;
export const savesInFlight = () => inFlight;

export class Saver {
  #started = 0;
  #shown = 0;
  /** The unanswered taps when there is no storage (the Week page's saver). */
  #unanswered: Unanswered[] = [];
  readonly #d: Required<SaverDeps>;

  constructor(deps: SaverDeps) {
    const online = () => typeof navigator === 'undefined' || navigator.onLine !== false;
    this.#d = { newKey: makeKey, now: Date.now, page: '/', online, ...deps };
  }

  /**
   * Sends one tap: action is the form action's name, fields the form's fields. A new key is made unless the fields carry one
   * (a re-send). The answer is the action's `answer`.
   */
  async send<A>(action: string, fields: FieldValues): Promise<Sent<A>> {
    const seq = ++this.#started;
    const all: FieldValues = { ...fields };
    const keyed = KEYED.has(action);
    const print = keyed ? fingerprint(this.#d.page, action, all) : '';
    // The same tap again within 10 minutes of one that got no answer goes with that tap's key (Web 65).
    if (keyed && typeof all.key !== 'string') all.key = this.#unansweredKey(action, print) ?? this.#d.newKey();
    const form = new FormData();
    for (const [k, v] of Object.entries(all)) for (const x of Array.isArray(v) ? v : [v]) form.append(k, x);

    const offline = !this.#d.online();
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), waitMs(action));
    let result: ActionResult;
    inFlight++;
    try {
      const res = await this.#d.fetch(`${this.#d.page}?/${action}`, {
        method: 'POST',
        body: form,
        headers: { accept: 'application/json', 'x-sveltekit-action': 'true' },
        cache: 'no-store',
        signal: abort.signal,
      });
      result = this.#d.deserialize(await res.text());
    } catch {
      // Offline before the send: nothing went out. Otherwise it may have arrived (Web 65).
      if (offline && !UNSURE.has(action)) {
        return this.#take(seq, action, { kind: 'problem', message: 'No connection to Logger (offline?). Nothing was saved; try again.' });
      }
      if (keyed) this.#rememberUnanswered(action, print, all.key as string);
      return this.#take(seq, action, { kind: 'problem', message: noAnswerText(action, all) });
    } finally {
      clearTimeout(timer);
      inFlight--;
    }

    // The server's door did not answer in time (Web 65): the same, with the server's words.
    if (result.type === 'failure' && result.data?.unsure) {
      if (keyed) this.#rememberUnanswered(action, print, all.key as string);
      const message = !UNSURE.has(action) && typeof result.data.message === 'string' ? result.data.message : noAnswerText(action, all);
      return this.#take(seq, action, { kind: 'problem', message });
    }
    // An answer of the door (a save, a refusal, a sign-out): the tap is no longer open.
    if (keyed && result.type !== 'error') this.#forgetUnanswered(print);

    if (result.type === 'success') return this.#take(seq, action, { kind: 'answer', answer: result.data?.answer as A });
    if (result.type === 'failure' && result.data?.signedOut) {
      // Kept whatever its age in the race: a sign-in is needed either way.
      if (mayResend(action)) this.#keep({ action, fields: all, at: this.#d.now(), page: this.#d.page });
      return { kind: 'signed_out' };
    }
    if (result.type === 'redirect') return { kind: 'signed_out' };
    const message =
      result.type === 'failure' && typeof result.data?.message === 'string'
        ? result.data.message
        : 'Something went wrong. Nothing was saved; try again in a moment.';
    // A link to app. when the door is off (step F); only a path or an https address, as the server sends it.
    const link = result.type === 'failure' && typeof result.data?.link === 'string' && /^(https:\/\/|\/)/.test(result.data.link) ? result.data.link : null;
    return this.#take(seq, action, { kind: 'problem', message, link });
  }

  /** After the sign-in: the tap kept when the session was gone, sent again with its own key (once; dropped after 10 minutes). */
  async resend<A>(): Promise<Sent<A> | null> {
    const kept = this.takeKept();
    return kept?.fresh ? this.send<A>(kept.action, kept.fields) : null;
  }

  /**
   * The tap kept when the session was gone, taken out (it is sent once at most). fresh: it may be sent again (within 10
   * minutes, with a key); a stale typed line's words can still go back into the logging box. A tap of another page stays kept
   * for that page (the sign-in leads back to it).
   */
  takeKept(): (Kept & { fresh: boolean }) | null {
    const kept = this.#kept();
    if (!kept || (kept.page ?? '/') !== this.#d.page) return null;
    try {
      this.#d.storage?.removeItem(RESEND_ITEM);
    } catch {
      /* storage blocked: nothing was kept anyway */
    }
    return { ...kept, fresh: this.#d.now() - kept.at <= RESEND_MS && mayResend(kept.action) };
  }

  /** Only the newest save's answer counts: an older one that arrives after it is dropped (but never a typed line's, SLOW). */
  #take<A>(seq: number, action: string, sent: Sent<A>): Sent<A> {
    if (seq < this.#shown && !SLOW.has(action)) return { kind: 'stale' };
    this.#shown = Math.max(this.#shown, seq);
    return sent;
  }

  /** The key of the same tap that got no answer within 10 minutes, or none. */
  #unansweredKey(action: string, print: string): string | undefined {
    return this.#openTaps().find((u) => u.action === action && u.print === print)?.key;
  }

  #rememberUnanswered(action: string, print: string, key: string) {
    const list = [...this.#openTaps().filter((u) => u.print !== print), { action, print, key, at: this.#d.now() }].slice(-20);
    this.#storeOpen(list);
  }

  #forgetUnanswered(print: string) {
    const list = this.#openTaps();
    if (list.some((u) => u.print === print)) this.#storeOpen(list.filter((u) => u.print !== print));
  }

  /** The unanswered taps of the last 10 minutes (older ones are dropped). */
  #openTaps(): Unanswered[] {
    let list: Unanswered[] = this.#unanswered;
    if (this.#d.storage) {
      try {
        const raw = this.#d.storage.getItem(UNANSWERED_ITEM);
        const parsed: unknown = raw ? JSON.parse(raw) : [];
        list = Array.isArray(parsed) ? (parsed as Unanswered[]) : [];
      } catch {
        list = this.#unanswered;
      }
    }
    const now = this.#d.now();
    return list.filter(
      (u) => u && typeof u.action === 'string' && typeof u.print === 'string' && typeof u.key === 'string' && typeof u.at === 'number' && now - u.at <= UNANSWERED_MS,
    );
  }

  #storeOpen(list: Unanswered[]) {
    this.#unanswered = list;
    if (!this.#d.storage) return;
    try {
      if (list.length) this.#d.storage.setItem(UNANSWERED_ITEM, JSON.stringify(list));
      else this.#d.storage.removeItem(UNANSWERED_ITEM);
    } catch {
      /* storage blocked: kept in this page's memory only */
    }
  }

  #keep(k: Kept) {
    try {
      this.#d.storage?.setItem(RESEND_ITEM, JSON.stringify(k));
    } catch {
      /* private mode or storage blocked: the tap is not re-sent, the page says to tap again */
    }
  }

  #kept(): Kept | null {
    try {
      const raw = this.#d.storage?.getItem(RESEND_ITEM);
      if (!raw) return null;
      const k = JSON.parse(raw) as Kept;
      return typeof k?.action === 'string' && k.fields && typeof k.at === 'number' ? k : null;
    } catch {
      return null;
    }
  }
}
