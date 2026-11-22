import { readEach } from '#lib/server/trendsread.js';
import { askedDays, type Insights } from '#lib/trendscharts.js';
import type { PageServerLoad } from './$types';

// Trends' Insights tab (deploy 103) from GET /api/v1/insights: nine cards (web item 50) over the last 90, 180 or 365 days
// (?days=180; 90 without or for anything else, never an error page), read only.
export const load: PageServerLoad = async (event) => {
  const days = askedDays(event.url.searchParams.get('days'));
  const [r] = await readEach(event, [{ path: '/insights', key: 'insights', query: { days: String(days) } }]);
  return { days, insights: r!.read as Insights | null, problem: r!.problem };
};
