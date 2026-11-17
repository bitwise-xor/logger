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
}

/** The actions whose door route takes a key (src/lib/server/saves.ts, `keyed`): only these are re-sent after a sign-in. */
export const KEYED = new Set([
  'log', 'water', 'again', 'usual', 'habit', 'checkin', 'health', 'held_retry', 'held_delete',
  // the usual meals (deploy 87): the Usual meals page's and the Food day's "Save as usual meal"
  'usual_meal', 'usual_new', 'usual_from_meal',
  // the scan sheet's new food (deploy 90)
  'labeladd',
  // the Health page's day row and body session (deploy 92)
  'health_day', 'body',
  // the Habits page's day tap and list forms (deploy 94): each gets a new key
  'habit_day', 'habits_manage',
  // the Gym's tick (deploy 96): the only gym save the door takes a key for
  'gym_tick',
  // Home (deploy 99): the saves the door keys (home._once): a tick, Done and "Done, next job" on Pick, a job done earlier
  'home_tick', 'home_pickdone', 'home_picknext', 'home_earlier',
  // Deploy 100: All done and a starting point's chips (the door keys both: home._once)
  'home_alldone', 'home_startpoint',
]);
/**
 * A keyed action that is never sent again by the page (deploy 94): a day tick of the Habits page. Its message carries the time
 * of the click, so the door does not replay a re-sent key: sent again while the day still needs a tick it is refused, sent after
 * the day is done it unticks. A tap that met a gone session is not kept; the page says to tap again after the sign-in.
 * Deploy 96: no gym save is sent again by the page either (a set is logged by a tap seen to work, never behind your back); the tick is
 * the only keyed one, the others take no key and are never kept anyway.
 * Deploy 97: the rule is for every gym save by its name (`gym_`): the Plan's and Exercises' forms take no key at the door, so a
 * second send would be a second change (a day added twice, an exercise moved twice), and a tap that met a gone session says to
 * tap again after the sign-in.
 * Deploy 99: no Home save is ever sent again by the page either (`home_`), keyed or not: the timer's start, pause, resume, stop and
 * "Not today" take no key at the door, a tick toggles, and a job is marked done only by a tap seen to work, never behind your back;
 * a tap that met a gone session is not kept (after the sign-in it is tapped again by hand).
 * Deploy 100: the same for Zones, History and Edit zones (All done, a starting point, ×, the forms): no Home save is re-sent.
 * Deploy 102: the Week review's button (`coach_start`) takes no key and is never sent again by the page: every start is read by
 * the AI and costs about 20 cents, so only the owner's press sends it (also not after a sign-in, not after a network error).
 * Deploy 109: the same for the day coaching's button (`coach_day`, Today's Coach card and the Coach page): no key, never sent again by the
 * page, also not after a sign-in or a network error (about 6 cents each; the door's refusal of a second one while one is read is only
 * a second line of defence).
 * Deploy 105: Library's Foods tab (`catalogue_`: values, words, barcode, basics, unit, reviewed) takes no key at the door and has no
 * Undo, so a second send would be a second change (a word added twice, a food hidden behind your back): never sent again by the page,
 * also not after a sign-in.
 * Deploy 106: Medical's three forms (`labs_`: a value, a report, a course and its End) take no key at the door and have no Undo either:
 * never sent again by the page, not after a sign-in (a change shown and said Yes to is made once, by a tap seen to work). A new course
 * typed in the Medication page's box is Today's `log`, keyed and treated as Today's is.
 */
export const NEVER_RESENT = new Set(['habit_day', 'gym_tick', 'home_tick', 'home_pickdone', 'home_picknext', 'home_earlier', 'home_alldone', 'home_startpoint']);
export const mayResend = (action: string) =>
  KEYED.has(action) && !NEVER_RESENT.has(action) && !action.startsWith('gym_') && !action.startsWith('home_') && !action.startsWith('coach_') && !action.startsWith('catalogue_') && !action.startsWith('labs_');
/** The saves that may have gone through although no answer came (a paid start): the network error does not say "nothing was saved". */
const UNSURE = new Set(['coach_start', 'coach_day']);
/** The actions the AI reads (up to about 40 s; the look-up since deploy 90): their answer is never dropped for a tap made while they were read. */
export const SLOW = new Set(['log', 'held_retry', 'lookup']);
export const RESEND_ITEM = 'logger-resend';
export const RESEND_MS = 10 * 60_000;

export function makeKey(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(18));
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
}

export interface Kept {
  action: string;
  fields: FieldValues;
  at: number;
  /** The page whose form action it is (deploy 87; none: Today, "/"): only that page sends it again. */
  page?: string;
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
      const message = UNSURE.has(action)
        ? 'No answer from Logger (offline?). The coaching may have started anyway: reload the page to see before you press again.'
        : 'No connection to Logger (offline?). Nothing was saved; try again.';
      return this.#take(seq, action, { kind: 'problem', message });
    }

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
