import { formActions } from '#lib/server/actions.js';
import { readDoor } from '#lib/server/read.js';
import { PLAN_SAVES } from '#lib/server/saves.js';
import type { Plan } from '#lib/gymplan.js';
import type { Actions, PageServerLoad } from './$types';

// The Gym's Plan part (deploy 97) from GET /api/v1/gym/plan: how the day is picked, a card per active workout day and the removed days.
export const load: PageServerLoad = async (event) => {
  const { read, undo, problem } = await readDoor<Plan>(event, '/gym/plan', 'gym_plan');
  return { plan: read, undo, problem };
};

/** The plan's forms and Undo (of a take-off): each answers with the fresh Plan (view "gym_plan"). */
export const actions = formActions(PLAN_SAVES, 'gym_plan') as Actions;
