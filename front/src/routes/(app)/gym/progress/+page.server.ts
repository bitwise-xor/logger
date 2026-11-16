import { readGym } from '#lib/server/gymread.js';
import { askedExercise, type Progress } from '#lib/gymread.js';
import type { PageServerLoad } from './$types';

// The Gym's Progress part (deploy 97) from GET /api/v1/gym/progress?x=<exercise id> (the most recently done one without it).
export const load: PageServerLoad = async (event) => {
  const { read, problem } = await readGym<Progress>(event, '/gym/progress', 'gym_progress', { x: askedExercise(event.url.searchParams.get('x')) });
  return { progress: read, problem };
};
