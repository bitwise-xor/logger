import { formActions } from '#lib/server/actions.js';
import { readGym } from '#lib/server/gymread.js';
import { EDIT_SAVES } from '#lib/server/saves.js';
import type { Edit } from '#lib/homeparts.js';
import type { Actions, PageServerLoad } from './$types';

// Home's Edit zones page (deploy 100) from GET /api/v1/home/edit: the weekly goal, the whole-flat chores, every zone (retired ones too)
// with its chores, the "Where" options and the limits of the fields.
export const load: PageServerLoad = async (event) => {
  const r = await readGym<Edit>(event, '/home/edit', 'home_edit');
  return { edit: r.read, problem: r.problem };
};

/** The goal, the zone and chore forms, Retire and Bring back, the Per zone table: each answers with the fresh Edit (view "home_edit"). No Undo here. */
export const actions = formActions(EDIT_SAVES, 'home_edit') as Actions;
