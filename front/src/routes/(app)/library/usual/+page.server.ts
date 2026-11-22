import { formActions } from '#lib/server/actions.js';
import { readDoor } from '#lib/server/read.js';
import { USUAL_SAVES } from '#lib/server/saves.js';
import type { Usual } from '#lib/usual.js';
import type { Actions, PageServerLoad } from './$types';

// The Usual meals page (deploy 87) from GET /api/v1/usual: every usual meal and drink by name, also those hidden from Today's
// chips. ?open=<meal_id> opens one (none: the list; a problem opens none).
export const load: PageServerLoad = async (event) => {
  const asked = event.url.searchParams.get('open');
  const open = asked && /^\d{1,9}$/.test(asked) ? Number(asked) : null;
  const r = await readDoor<Usual[]>(event, '/usual', 'usual', undefined, { notThere: 'problem' });
  return { usual: r.read, undo: r.undo, open: r.problem ? null : open, problem: r.problem };
};

/** A meal changed or deleted, a new one, and Undo: each answers with the whole list fresh (view "usual"). */
export const actions = formActions(USUAL_SAVES, 'usual') as Actions;
