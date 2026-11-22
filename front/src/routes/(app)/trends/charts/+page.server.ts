import { readDoors } from '#lib/server/read.js';
import { askedExercise, type Progress } from '#lib/gymread.js';
import { askedRange, type Body, type Health } from '#lib/health.js';
import type { FoodTrends } from '#lib/trendscharts.js';
import type { PageServerLoad } from './$types';

// Trends' Charts tab (deploy 103): the door's food trends, health and body reads of one range (?range=7|30|90, 30 without or for
// anything else, as /health does) and the gym progress of ?x=<exercise id> (a bad x is dropped: the door picks the most recent one;
// always the last 8 weeks, whatever the range). The four reads go together and each answers for itself: one failing leaves the other
// sections drawn (readDoors; a 404 or 400, or an answer without its read, is that section's trouble).
export const load: PageServerLoad = async (event) => {
  const range = askedRange(event.url.searchParams.get('range'));
  const x = askedExercise(event.url.searchParams.get('x'));
  const r = String(range);
  const [food, health, body, gym] = await readDoors(event, [
    { path: '/food/trends', key: 'trends', query: { range: r } },
    { path: '/health', key: 'health', query: { range: r } },
    { path: '/body', key: 'body', query: { range: r } },
    { path: '/gym/progress', key: 'gym_progress', query: x ? { x } : undefined },
  ], { notThere: 'problem', required: true });
  return {
    range,
    x: x ?? null,
    food: { read: food!.read as FoodTrends | null, problem: food!.problem },
    health: { read: health!.read as Health | null, problem: health!.problem },
    body: { read: body!.read as Body | null, problem: body!.problem },
    gym: { read: gym!.read as Progress | null, problem: gym!.problem },
  };
};
