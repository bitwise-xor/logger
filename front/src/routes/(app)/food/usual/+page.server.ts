import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

// The Usual meals page moved under Library in deploy 105 (/library/usual): an old address (a bookmark, ?open=) leads there with its
// query. A temporary redirect, so a rollback to an older image never meets a browser that remembers the move.
export const load: PageServerLoad = ({ url }) => redirect(302, `/library/usual${url.search}`);
