/**
 * Saving in place (step C, deploy 80), in the browser: a tap posts its form to the page's form action (`/?/water`, …) and the
 * answer's fresh day replaces what is on screen, with no reload (the plan, "Saving in place").
 *
 * - The key rule: every tap gets a new `key`; the same tap sent again (after a sign-in) keeps its key, so the door saves it once.
 * - Newest answer wins: when two saves overlap, an answer that comes back after a newer one's is dropped (its day is older).
 * - Signed out mid-save: the tap and its key are kept in the tab's sessionStorage; after the sign-in Today sends it again
 *   (only a tap the door can tell apart by its key, and only within 10 minutes).
 *
 * Plain TypeScript: the network, SvelteKit's `deserialize` and the storage are handed in, so the tests can fake them.
 */

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
  | { kind: 'problem'; message: string };

export type FieldValues = Record<string, string | string[]>;

export interface SaverDeps {
  fetch: (url: string, init: RequestInit) => Promise<Response>;
  deserialize: (text: string) => ActionResult;
  storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null;
  newKey?: () => string;
  now?: () => number;
  /** The page whose actions are called: "/" (Today). */
  page?: string;
}

/** The actions whose door route takes a key (src/lib/server/saves.ts, `keyed`): only these are re-sent after a sign-in. */
export const KEYED = new Set(['water', 'again', 'usual', 'habit', 'checkin', 'health', 'held_retry', 'held_delete']);
export const RESEND_ITEM = 'logger-resend';
export const RESEND_MS = 10 * 60_000;

export function makeKey(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(18));
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
}

interface Kept {
  action: string;
  fields: FieldValues;
  at: number;
}

export class Saver {
  #started = 0;
  #shown = 0;
  readonly #d: Required<SaverDeps>;

  constructor(deps: SaverDeps) {
    this.#d = { newKey: makeKey, now: Date.now, page: '/', ...deps };
  }

  /**
   * Sends one tap: action is the form action's name, fields the form's fields. A new key is made unless the fields carry one
   * (a re-send). The answer is the action's `answer`.
   */
  async send<A>(action: string, fields: FieldValues): Promise<Sent<A>> {
    const seq = ++this.#started;
    const all: FieldValues = { ...fields };
    if (KEYED.has(action) && typeof all.key !== 'string') all.key = this.#d.newKey();
    const form = new FormData();
    for (const [k, v] of Object.entries(all)) for (const x of Array.isArray(v) ? v : [v]) form.append(k, x);

    let result: ActionResult;
    try {
      const res = await this.#d.fetch(`${this.#d.page}?/${action}`, {
        method: 'POST',
        body: form,
        headers: { accept: 'application/json', 'x-sveltekit-action': 'true' },
        cache: 'no-store',
      });
      result = this.#d.deserialize(await res.text());
    } catch {
      return this.#take(seq, { kind: 'problem', message: 'No connection to the logger. Nothing was saved; try again.' });
    }

    if (result.type === 'success') return this.#take(seq, { kind: 'answer', answer: result.data?.answer as A });
    if (result.type === 'failure' && result.data?.signedOut) {
      // Kept whatever its age in the race: a sign-in is needed either way.
      if (KEYED.has(action)) this.#keep({ action, fields: all, at: this.#d.now() });
      return { kind: 'signed_out' };
    }
    if (result.type === 'redirect') return { kind: 'signed_out' };
    const message =
      result.type === 'failure' && typeof result.data?.message === 'string'
        ? result.data.message
        : 'Something went wrong. Nothing was saved; try again in a moment.';
    return this.#take(seq, { kind: 'problem', message });
  }

  /** After the sign-in: the tap kept when the session was gone, sent again with its own key (once; dropped after 10 minutes). */
  async resend<A>(): Promise<Sent<A> | null> {
    const kept = this.#kept();
    if (!kept) return null;
    try {
      this.#d.storage?.removeItem(RESEND_ITEM);
    } catch {
      /* storage blocked: nothing was kept anyway */
    }
    if (this.#d.now() - kept.at > RESEND_MS || !KEYED.has(kept.action)) return null;
    return this.send<A>(kept.action, kept.fields);
  }

  /** Only the newest save's answer counts: an older one that arrives after it is dropped. */
  #take<A>(seq: number, sent: Sent<A>): Sent<A> {
    if (seq < this.#shown) return { kind: 'stale' };
    this.#shown = seq;
    return sent;
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
