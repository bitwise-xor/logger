import { readDoor } from '#lib/server/read.js';
import { askedDays, type Insights } from '#lib/trendscharts.js';
import type { PageServerLoad } from './$types';

// Trends' Insights tab (deploy 103) from GET /api/v1/insights: nine cards (web item 50) over the last 90, 180 or 365 days
// (?days=180; 90 without or for anything else, never an error page), read only. Any trouble, a 404 or 400 too, and an answer
// without the cards is the page's problem (as Trends' Charts).
export const load: PageServerLoad = async (event) => {
  const days = askedDays(event.url.searchParams.get('days'));
  const r = await readDoor<Insights>(event, '/insights', 'insights', { days: String(days) }, { notThere: 'problem', required: true });
  return { days, insights: r.read, problem: r.problem };
};
