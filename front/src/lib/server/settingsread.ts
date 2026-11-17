/**
 * Settings' tabs read the same way (deploy 111): GET /api/v1/settings/<tab> through readGym (the session renewed, a gone session to
 * the sign-in page and back); any other trouble, a 400 too, is the tab's ProblemCard with app.'s own tab.
 */
import { readGym } from './gymread.js';
import type { SettingsTab } from '../places.js';
import type { ProblemKind } from '../problems.js';

export async function readSettings<T>(
  event: Parameters<typeof readGym>[0],
  tab: SettingsTab,
): Promise<{ read: T | null; problem: ProblemKind | null }> {
  const r = await readGym<T>(event, `/settings/${tab}`, `settings_${tab}`);
  return { read: r.read, problem: r.problem ?? (r.read ? null : 'trouble') };
}
