import { readDoor } from '#lib/server/read.js';
import type { Recent } from '#lib/recent.js';
import type { PageServerLoad } from './$types';

// More's Recent (deploy 108) from GET /api/v1/recent (read only): the last 50 messages by day, each with what it saved. A private
// entry comes as its label only. "Use again" keeps the words in the tab's storage and goes to Today (src/lib/recent.ts).
export const load: PageServerLoad = async (event) => {
  const { read, problem } = await readDoor<Recent>(event, '/recent', 'recent');
  return { recent: read, problem };
};
