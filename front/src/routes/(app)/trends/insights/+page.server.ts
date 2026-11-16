import { readEach } from '#lib/server/trendsread.js';
import type { Insights } from '#lib/trendscharts.js';
import type { PageServerLoad } from './$types';

// Trends' Insights tab (deploy 103) from GET /api/v1/insights: three cards over the last 90 days, read only.
export const load: PageServerLoad = async (event) => {
  const [r] = await readEach(event, [{ path: '/insights', key: 'insights' }]);
  return { insights: r!.read as Insights | null, problem: r!.problem };
};
