import { readGym } from '#lib/server/gymread.js';
import { askedRange, type Usage } from '#lib/usage.js';
import type { PageServerLoad } from './$types';

// More's Usage (deploy 108) from GET /api/v1/usage?r=7|30|all (read only): what the AI calls cost. 7 days without ?r= or for anything else.
export const load: PageServerLoad = async (event) => {
  const { read, problem } = await readGym<Usage>(event, '/usage', 'usage', { r: askedRange(event.url.searchParams.get('r')) });
  return { usage: read, problem };
};
