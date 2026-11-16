import { readGym } from '#lib/server/gymread.js';
import { choreIdOf, type Chore } from '#lib/homeparts.js';
import type { PageServerLoad } from './$types';

// A chore's own page (deploy 100) from GET /api/v1/home/chore?id=: any chore, a retired one too. An id that is no id, or a chore that
// is not there, is said on the page ("That chore is not in the list."), not as an error page. Nothing saves here (Edit leads to Edit
// zones with this chore's form open).
export const load: PageServerLoad = async (event) => {
  // no id, or one that is no id: the door says 400 (and 404 for a chore that is not there); both are "missing" here
  const r = await readGym<Chore>(event, '/home/chore', 'home_chore', { id: choreIdOf(event.url.searchParams.get('id')) || undefined });
  return { chore: r.read, missing: !!r.missing, problem: r.problem };
};
