import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

/**
 * Web 66: an address no page of the app has. Without this, SvelteKit answers it with the root error page, outside the app's
 * layout; here the layout's session check runs first (signed out: to the sign-in page) and the 404 is shown with the rail or the
 * tab bar ((app)/+error.svelte).
 */
export const load: PageServerLoad = () => error(404, 'Not found');
