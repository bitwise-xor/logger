import { readGym } from '#lib/server/gymread.js';
import { askedQ, type Search } from '#lib/search.js';
import type { PageServerLoad } from './$types';

// More's Search (deploy 108) from GET /api/v1/search?q= (read only): the door's five groups (foods in the catalogue, what you ate, gym
// workouts, chores done, lab tests). Under two letters the door says so (`hint`). Thoughts are not here: they are searched at app.
export const load: PageServerLoad = async (event) => {
  const q = askedQ(event.url.searchParams.get('q'));
  const { read, problem } = await readGym<Search>(event, '/search', 'search', { q });
  return { search: read, q, problem };
};
