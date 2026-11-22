import { formActions } from '#lib/server/actions.js';
import { readDoor } from '#lib/server/read.js';
import { GYM_SAVES } from '#lib/server/saves.js';
import type { Workout } from '#lib/gym.js';
import type { Actions, PageServerLoad } from './$types';

// The Gym's Workout page (deploy 96) from GET /api/v1/gym: today's day of the split, the exercises with their circles, "This
// week's split" and the last 4 weeks.
export const load: PageServerLoad = async (event) => {
  const r = await readDoor<Workout>(event, '/gym', 'gym', undefined, { notThere: 'problem' });
  return { workout: r.read, undo: r.undo, problem: r.problem };
};

/** A tick, a remove, the day pick, + Add exercise and Undo: each answers with the fresh Workout (view "gym"). */
export const actions = formActions(GYM_SAVES, 'gym') as Actions;
