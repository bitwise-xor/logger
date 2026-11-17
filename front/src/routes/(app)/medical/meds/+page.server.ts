import { formActions } from '#lib/server/actions.js';
import { readGym } from '#lib/server/gymread.js';
import { MEDICAL_MEDS_SAVES } from '#lib/server/saves.js';
import type { Meds } from '#lib/medical.js';
import type { Actions, PageServerLoad } from './$types';

// Medical's Medication tab (deploy 106) from GET /api/v1/labs/meds.
export const load: PageServerLoad = async (event) => {
  const r = await readGym<Meds>(event, '/labs/meds', 'labs_meds');
  return { meds: r.read, undo: r.undo, problem: r.problem ?? (r.missing ? 'trouble' : null) };
};

/** The course's form and End, a new course through Today's typed line and its yes: each answers with the fresh Medication (view "labs_meds"). */
export const actions = formActions(MEDICAL_MEDS_SAVES, 'labs_meds') as Actions;
