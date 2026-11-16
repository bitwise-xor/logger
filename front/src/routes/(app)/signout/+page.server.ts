import { redirect } from '@sveltejs/kit';
import { door } from '#lib/server/config.js';
import { signOut } from '#lib/server/signin.js';
import type { Actions, PageServerLoad } from './$types';

// Only the form's POST signs out; opening the address does nothing.
export const load: PageServerLoad = () => redirect(303, '/');

export const actions: Actions = {
  default: async ({ cookies }) => {
    await signOut(door, cookies);
    redirect(303, '/login');
  },
};
