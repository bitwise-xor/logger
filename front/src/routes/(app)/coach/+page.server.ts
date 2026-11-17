import { askedDay, askedFilter, latestDay, type CoachRead } from '#lib/coach.js';
import { formActions } from '#lib/server/actions.js';
import { readGym } from '#lib/server/gymread.js';
import { COACH_SAVES } from '#lib/server/saves.js';
import type { Actions, PageServerLoad } from './$types';

// More's Coach page (deploy 109) from GET /api/v1/coach?f=all|days|weeks&day=yyyy-mm-dd: every finished coaching, the filters, this
// month's line and the card of the day for "Coach a day" (today without ?day=). A bad ?f= or ?day= is dropped, as the other pages do,
// so the door's 400 is not asked for; a day the door refuses (after its today) falls back to today.
export const load: PageServerLoad = async (event) => {
  const f = askedFilter(event.url.searchParams.get('f')) ?? 'all';
  const asked = askedDay(event.url.searchParams.get('day'));
  const query = (day: string | undefined) => ({ f: f === 'all' ? undefined : f, day });
  let r = await readGym<CoachRead>(event, '/coach', 'coach', query(asked));
  if (r.missing && asked) r = await readGym<CoachRead>(event, '/coach', 'coach', query(undefined));
  // the latest day the date field offers (the door refuses a day after its today)
  const latest = r.read ? latestDay(r.read.day, asked && r.read.day === asked ? asked : undefined) : null;
  return { coach: r.read, problem: r.problem ?? (r.missing ? 'trouble' : null), latest };
};

/** The day coaching's button: POST /coach/start, kind "day", answered with the coaching and the fresh Coach page (view "coach"). */
export const actions = formActions(COACH_SAVES, 'coach') as Actions;
