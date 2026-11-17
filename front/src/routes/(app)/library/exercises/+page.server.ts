import { formActions } from '#lib/server/actions.js';
import { readGym } from '#lib/server/gymread.js';
import { EXERCISES_SAVES } from '#lib/server/saves.js';
import type { Exercises } from '#lib/gymplan.js';
import type { Actions, PageServerLoad } from './$types';

// Library's Exercises tab (deploy 105): the Gym's Exercises part from the same GET /api/v1/gym/exercises.
export const load: PageServerLoad = async (event) => {
  const { read, problem } = await readGym<Exercises>(event, '/gym/exercises', 'gym_exercises');
  return { exercises: read, problem };
};

/** Rename, Retire or Bring back and + New exercise, as on /gym/exercises (view "gym_exercises"). No Undo here. */
export const actions = formActions(EXERCISES_SAVES, 'gym_exercises') as Actions;
