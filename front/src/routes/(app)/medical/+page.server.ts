import { formActions } from '#lib/server/actions.js';
import { readDoor } from '#lib/server/read.js';
import { MEDICAL_REPORTS_SAVES } from '#lib/server/saves.js';
import { askedOpen, type Labs } from '#lib/medical.js';
import type { Actions, PageServerLoad } from './$types';

// Medical's Reports tab (deploy 106) from GET /api/v1/labs?open=R12 (the report open; one that is not there: none open, as app.).
// readDoor: the session renewed, a gone session to the sign-in and back here, any other trouble as a plain message (ProblemCard).
export const load: PageServerLoad = async (event) => {
  const open = askedOpen(event.url.searchParams.get('open'));
  const r = await readDoor<Labs>(event, '/labs', 'labs', { open: open ? `R${open}` : undefined });
  return { labs: r.read, open, undo: r.undo, problem: r.problem ?? (r.missing ? 'trouble' : null) };
};

/** A value's and a report's forms: each answers with the fresh Reports and the report open (view "labs"). */
export const actions = formActions(MEDICAL_REPORTS_SAVES, 'labs') as Actions;
