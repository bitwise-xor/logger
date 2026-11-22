import { readDoor } from '#lib/server/read.js';
import type { HistoryWorkout } from '#lib/gymread.js';
import { askedWorkout } from '#lib/search.js';
import type { PageServerLoad } from './$types';

// The Gym's History part (deploy 97) from GET /api/v1/gym/history: the last 60 workouts, newest first. ?w=<workout id> (deploy 108: a search
// result) asks for that workout too, in its place by date, when it is older than the last 60 (digits only; anything else is dropped).
export const load: PageServerLoad = async (event) => {
  const { read, problem } = await readDoor<{ workouts: HistoryWorkout[] }>(event, '/gym/history', 'gym_history', { w: askedWorkout(event.url.searchParams.get('w')) });
  return { workouts: read?.workouts ?? null, problem };
};
