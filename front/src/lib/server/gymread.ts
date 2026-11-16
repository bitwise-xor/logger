/**
 * The Gym's parts load their read the same way (deploy 97): one GET of the door's /gym/<part>, the session renewed, a gone session
 * sent to the sign-in page (and back here after it), and any other trouble as a plain message the page draws (step F).
 */
import { redirect, type Cookies } from '@sveltejs/kit';
import { door } from './config.js';
import { endSession, renewSession } from './session.js';
import { loginHref } from '../next.js';
import { problemOf, type ProblemKind } from '../problems.js';
import type { Undo } from '../day.js';

export interface Read<T> {
  read: T | null;
  undo: Undo | null;
  problem: ProblemKind | null;
  /** The thing asked for is not there (the door's 404 `no_entry`, or a 400 for an id that is no id): a chore's page says so on the page (deploy 100). */
  missing?: boolean;
}

/** `key` is the read's name in the answer (`gym_plan`, `gym_exercises`, `gym_progress`, `gym_history`, `gym_activity`). */
export async function readGym<T>(
  event: { locals: { session?: string | null }; cookies: Cookies; url: URL },
  path: string,
  key: string,
  query?: Record<string, string | undefined>,
): Promise<Read<T>> {
  const { locals, cookies, url } = event;
  const session = locals.session;
  if (!session) redirect(303, loginHref(url.pathname + url.search));
  try {
    const { body, expiresAt } = await door.get<Record<string, unknown>>(path, session, query);
    renewSession(cookies, session, expiresAt);
    return { read: (body[key] as T) ?? null, undo: (body.undo as Undo | null) ?? null, problem: null };
  } catch (error) {
    const problem = problemOf(error);
    if (problem === 'signed_out') {
      endSession(cookies);
      redirect(303, loginHref(url.pathname + url.search));
    }
    const e = (error ?? {}) as { code?: unknown };
    if (e.code === 'no_entry' || e.code === 'bad_request') return { read: null, undo: null, problem: null, missing: true };
    return { read: null, undo: null, problem };
  }
}
