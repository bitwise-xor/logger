import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

// Settings (deploy 111): /settings is its first tab, Food targets (as app.'s /web/settings).
export const load: PageServerLoad = () => redirect(307, '/settings/targets');
