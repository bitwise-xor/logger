/**
 * The places of the app (deploy 96, the Spaces menu): the tab or rail item a page belongs to, and the Spaces. The PC's rail shows
 * Today, Trends, Library, the Spaces (Gym, Health, Habits, and Home since deploy 99) and More; phones and tablets four tabs, with
 * the Spaces on the More page (/more), where Medical waits greyed ("soon"). Plain TypeScript, so the tests need no browser.
 */

export interface Space {
  key: string;
  name: string;
  /** Its page here; null: not moved yet ("soon"). */
  href: string | null;
  /** The line under its name on the More page. */
  sub: string;
}

export const SPACES: Space[] = [
  { key: 'gym', name: 'Gym', href: '/gym', sub: 'Today’s workout, the split, the last 4 weeks' },
  { key: 'health', name: 'Health', href: '/health', sub: 'Weight, blood pressure, sugar, sleep, body' },
  { key: 'habits', name: 'Habits', href: '/habits', sub: 'Today’s ticks and the last 30 days' },
  { key: 'home', name: 'Home', href: '/home', sub: 'Chores by zone, a job for the time you have' },
  { key: 'medical', name: 'Medical', href: null, sub: 'soon' },
];

/**
 * Where a path belongs: the tab (Today for Today and the Food day with its usual meals; More for /more and every Space) and the
 * Space (on the PC's rail the Space itself is highlighted, on phones and tablets the More tab).
 */
export function placeOf(path: string): { tab: 'today' | 'more' | null; space: string | null; atMore: boolean } {
  const under = (p: string) => path === p || path.startsWith(`${p}/`);
  const space = SPACES.find((s) => s.href && under(s.href))?.key ?? null;
  if (space) return { tab: 'more', space, atMore: false };
  if (under('/more')) return { tab: 'more', space: null, atMore: true };
  if (path === '/' || under('/food')) return { tab: 'today', space: null, atMore: false };
  return { tab: null, space: null, atMore: false };
}
