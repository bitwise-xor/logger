import { formActions } from '#lib/server/actions.js';
import { readGym } from '#lib/server/gymread.js';
import { EXERCISES_SAVES } from '#lib/server/saves.js';
import type { Exercises } from '#lib/gymplan.js';
import type { Actions, PageServerLoad } from './$types';

// The Gym's Exercises part (deploy 97) from GET /api/v1/gym/exercises: every exercise with its kind, words and use.
export const load: PageServerLoad = async (event) => {
  const { read, problem } = await readGym<Exercises>(event, '/gym/exercises', 'gym_exercises');
  return { exercises: read, problem };
};

/** Rename, Retire or Bring back and + New exercise: each answers with the fresh Exercises (view "gym_exercises"). No Undo here. */
export const actions = formActions(EXERCISES_SAVES, 'gym_exercises') as Actions;
