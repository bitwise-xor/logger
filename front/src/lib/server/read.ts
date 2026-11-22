/**
 * The one read of the door for a page's load (web item 72, 22.11.2026; before it, readGym, readEach, readSettings and a try/catch
 * copied into each of the older pages and the layout): a GET of the door with the session, the session renewed from the answer, a
 * gone session sent to the sign-in page (and back to this page after it: `next`), and any other trouble handed to the page as a
 * plain problem kind it draws (src/lib/problems.ts, step F). The page gets null for the read and for the Undo then.
 *
 * Where the pages differ, it is an option, as each did before:
 * - `notThere`: the door's 404 `no_entry` or a 400 (an id that is no id): 'missing' (the default, readGym's since deploy 100: no
 *   problem, `missing: true`, so a chore's page or a food's box can say so in place) or 'problem' (the older pages: its kind,
 *   'trouble', like any other error).
 * - `required`: a good answer without the read is 'trouble' (Trends' reads and Settings' tabs).
 * - several reads at once (`readDoors`): each answers for itself (Trends' Charts: one failing leaves the others drawn; renewed from
 *   the first that answered), or `together` (the Health page's two: one failing fails both with its kind; renewed from the first
 *   answer that says when the session ends).
 */
import { redirect, type Cookies } from '@sveltejs/kit';
import { door } from './config.js';
import { endSession, renewSession } from './session.js';
import { loginHref } from '../next.js';
import { problemOf, type ProblemKind } from '../problems.js';
import type { Undo } from '../day.js';
import type { SettingsTab } from '../places.js';

export interface ReadEvent {
  locals: { session?: string | null };
  cookies: Cookies;
  url: URL;
}

export interface Ask {
  path: string;
  /** The read's name in the answer (`day`, `gym_plan`, `settings_body`, …). */
  key: string;
  query?: Record<string, string | undefined>;
}

export interface ReadOptions {
  notThere?: 'missing' | 'problem';
  required?: boolean;
}

export interface Read<T> {
  read: T | null;
  undo: Undo | null;
  problem: ProblemKind | null;
  /** The thing asked for is not there (the door's 404 `no_entry`, or a 400 for an id that is no id; `notThere: 'missing'` only). */
  missing?: boolean;
}

type Answer = { ok: true; body: Record<string, unknown>; expiresAt: string | null } | { ok: false; error: unknown };

/** The session, or straight to the sign-in page (and back here after it). */
function sessionOf(event: ReadEvent): string {
  const session = event.locals.session;
  if (!session) redirect(303, loginHref(event.url.pathname + event.url.search));
  return session;
}

/** A gone session: the cookie ended and to the sign-in page (and back here after it). */
function signedOut(event: ReadEvent): never {
  endSession(event.cookies);
  redirect(303, loginHref(event.url.pathname + event.url.search));
}

function ask(session: string, a: Ask): Promise<Answer> {
  return door.get<Record<string, unknown>>(a.path, session, a.query).then(
    ({ body, expiresAt }) => ({ ok: true as const, body, expiresAt }),
    (error: unknown) => ({ ok: false as const, error }),
  );
}

function readOf<T>(answer: Answer, a: Ask, options: ReadOptions): Read<T> {
  if (answer.ok) {
    const read = (answer.body[a.key] as T | undefined) ?? null;
    return { read, undo: (answer.body.undo as Undo | null | undefined) ?? null, problem: options.required && read === null ? 'trouble' : null };
  }
  const problem = problemOf(answer.error);
  // a gone session is sent to the sign-in page before any read is drawn (readDoor, readDoors)
  if (problem === 'signed_out') return { read: null, undo: null, problem: 'trouble' };
  const e = (answer.error ?? {}) as { code?: unknown };
  if ((options.notThere ?? 'missing') === 'missing' && (e.code === 'no_entry' || e.code === 'bad_request')) {
    return { read: null, undo: null, problem: null, missing: true };
  }
  return { read: null, undo: null, problem };
}

/** One read: `key` is the read's name in the answer. */
export async function readDoor<T>(
  event: ReadEvent,
  path: string,
  key: string,
  query?: Record<string, string | undefined>,
  options: ReadOptions = {},
): Promise<Read<T>> {
  const session = sessionOf(event);
  const answer = await ask(session, { path, key, query });
  if (!answer.ok && problemOf(answer.error) === 'signed_out') signedOut(event);
  if (answer.ok) renewSession(event.cookies, session, answer.expiresAt);
  return readOf<T>(answer, { path, key, query }, options);
}

/** Several reads at once, in the order asked (see the options above). */
export async function readDoors(event: ReadEvent, asks: Ask[], options: ReadOptions & { together?: boolean } = {}): Promise<Read<unknown>[]> {
  const session = sessionOf(event);
  if (options.together) {
    // as Promise.all: the first failure (in time) is the answer for all
    let answers: Answer[];
    try {
      answers = await Promise.all(
        asks.map((a) => door.get<Record<string, unknown>>(a.path, session, a.query).then(({ body, expiresAt }) => ({ ok: true as const, body, expiresAt }))),
      );
    } catch (error) {
      if (problemOf(error) === 'signed_out') signedOut(event);
      return asks.map((a) => readOf({ ok: false, error }, a, options));
    }
    renewSession(event.cookies, session, answers.reduce<string | null>((at, x) => at ?? (x.ok ? x.expiresAt : null), null));
    return answers.map((x, k) => readOf(x, asks[k]!, options));
  }
  const answers = await Promise.all(asks.map((a) => ask(session, a)));
  if (answers.some((x) => !x.ok && problemOf(x.error) === 'signed_out')) signedOut(event);
  const first = answers.find((x) => x.ok);
  if (first?.ok) renewSession(event.cookies, session, first.expiresAt);
  return answers.map((x, k) => readOf(x, asks[k]!, options));
}

/**
 * Settings' tabs (deploy 111): GET /api/v1/settings/<tab>; any trouble, a 400 too, and an answer without the tab is the tab's
 * ProblemCard with app.'s own tab. The page gets the read and the problem only.
 */
export async function readSettings<T>(event: ReadEvent, tab: SettingsTab): Promise<{ read: T | null; problem: ProblemKind | null }> {
  const r = await readDoor<T>(event, `/settings/${tab}`, `settings_${tab}`, undefined, { notThere: 'problem', required: true });
  return { read: r.read, problem: r.problem };
}
