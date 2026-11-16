import { fail, redirect } from '@sveltejs/kit';
import { appUrl, door } from '#lib/server/config.js';
import { signIn } from '#lib/server/signin.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => {
  // A cookie that is no longer good is dropped by the (app) layout, which sends the browser back here.
  if (locals.session) redirect(303, '/');
  return { appUrl };
};

export const actions: Actions = {
  default: async ({ request, cookies }) => {
    const form = await request.formData();
    const result = await signIn(door, cookies, {
      password: String(form.get('password') ?? ''),
      code: String(form.get('code') ?? ''),
      userAgent: request.headers.get('user-agent'),
    });
    if (!result.ok) return fail(result.status, { message: result.message });
    redirect(303, '/');
  },
};
