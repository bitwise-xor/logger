import { fail, redirect } from '@sveltejs/kit';
import { appUrl, door } from '#lib/server/config.js';
import { signIn } from '#lib/server/signin.js';
import { safeNext } from '#lib/next.js';
import { problemOf, type ProblemKind } from '#lib/problems.js';
import type { Actions, PageServerLoad } from './$types';

/**
 * Before you type (step F): one GET /session without a session says whether the door is there. The door's 401 `signed_out` is
 * the good answer; 404 means the door is off, no answer means the core is down, and the page says so above the form.
 * After the sign-in: back to the page you were on (`?next=`, only a path of this app: src/lib/next.ts).
 */
export const load: PageServerLoad = async ({ locals, url }) => {
  const next = safeNext(url.searchParams.get('next'));
  // A cookie that is no longer good is dropped by the (app) layout, which sends the browser back here.
  if (locals.session) redirect(303, next);
  let problem: ProblemKind | null = null;
  try {
    await door.get('/session', null);
  } catch (error) {
    const kind = problemOf(error);
    problem = kind === 'signed_out' ? null : kind;
  }
  return { appUrl, problem };
};

export const actions: Actions = {
  default: async ({ request, cookies, url }) => {
    const form = await request.formData();
    const result = await signIn(door, cookies, {
      password: String(form.get('password') ?? ''),
      code: String(form.get('code') ?? ''),
      userAgent: request.headers.get('user-agent'),
    });
    if (!result.ok) return fail(result.status, { message: result.message, problem: result.problem ?? null });
    redirect(303, safeNext(url.searchParams.get('next')));
  },
};
