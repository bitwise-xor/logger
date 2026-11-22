import { readDoor } from '#lib/server/read.js';
import { askedDay, type Activity } from '#lib/gymread.js';
import type { PageServerLoad } from './$types';

// The Gym's Activity part (deploy 97) from GET /api/v1/gym/activity?day=yyyy-mm-dd (today without; read only): one day of the watch's
// data, or the set-up guide while the watch has sent nothing.
export const load: PageServerLoad = async (event) => {
  const { read, problem } = await readDoor<Activity>(event, '/gym/activity', 'gym_activity', { day: askedDay(event.url.searchParams.get('day')) });
  return { activity: read, problem };
};
