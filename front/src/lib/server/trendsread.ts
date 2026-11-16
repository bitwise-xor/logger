/**
 * Trends' Charts tab asks four reads at once (deploy 103: food, health, body, gym) and one that fails must not blank the page: each
 * answers on its own with its read or its plain problem (src/lib/problems.ts). A gone session on any of them still goes to the
 * sign-in page (and back here after it), and the session is renewed once, from the first answer that says when it ends.
 */
import { redirect, type Cookies } from '@sveltejs/kit';
import { door } from './config.js';
import { endSession, renewSession } from './session.js';
import { loginHref } from '../next.js';
import { problemOf, type ProblemKind } from '../problems.js';

export interface Ask {
  path: string;
  /** The read's name in the answer (`trends`, `health`, `body`, `gym_progress`, `insights`). */
  key: string;
  query?: Record<string, string>;
}

export interface Got<T> {
  read: T | null;
  problem: ProblemKind | null;
}

export async function readEach(
  event: { locals: { session?: string | null }; cookies: Cookies; url: URL },
  asks: Ask[],
): Promise<Got<unknown>[]> {
  const { locals, cookies, url } = event;
  const session = locals.session;
  if (!session) redirect(303, loginHref(url.pathname + url.search));
  const answers = await Promise.all(
    asks.map((a) =>
      door.get<Record<string, unknown>>(a.path, session, a.query).then(
        (r) => ({ ok: true as const, r, a }),
        (error: unknown) => ({ ok: false as const, problem: problemOf(error) }),
      ),
    ),
  );
  if (answers.some((x) => !x.ok && x.problem === 'signed_out')) {
    endSession(cookies);
    redirect(303, loginHref(url.pathname + url.search));
  }
  const first = answers.find((x) => x.ok);
  if (first?.ok) renewSession(cookies, session, first.r.expiresAt);
  return answers.map((x): Got<unknown> => {
    if (x.ok) {
      const read = x.r.body[x.a.key] ?? null;
      return { read, problem: read === null ? 'trouble' : null };
    }
    return { read: null, problem: x.problem === 'signed_out' ? 'trouble' : x.problem };
  });
}
