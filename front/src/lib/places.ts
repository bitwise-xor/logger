/**
 * The places of the app (deploy 96, the Spaces menu): the tab or rail item a page belongs to, and the Spaces. The PC's rail shows
 * Today, Trends (a page of this app since deploy 102), Library (since deploy 105), the Spaces (Gym, Health, Habits, Home since deploy 99, and
 * Medical since deploy 106) and More; phones and tablets four tabs, with the Spaces on the More page (/more). Search, Recent and Usage (deploy
 * 108) are pages under More. Plain TypeScript, so the tests need no browser.
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
  { key: 'medical', name: 'Medical', href: '/medical', sub: 'Lab reports, tests over time, medication' },
];

/**
 * The More page's own places (deploy 108): Coach, Recent, Usage and Settings. `here` is the page of this app, null while it is still
 * at app. (then `app` is its path there, and the row says "app."). Coach moves with deploy 109 and Settings with 111: each is a
 * one-line change here (put its path in `here`).
 */
export interface MorePlace {
  key: string;
  name: string;
  sub: string;
  here: string | null;
  app: string;
}

export const MORE_PLACES: MorePlace[] = [
  { key: 'coach', name: 'Coach', sub: 'Every coaching, a day or a week', here: null, app: '/web/coach' },
  { key: 'recent', name: 'Recent', sub: 'What you sent, and what it saved', here: '/recent', app: '/web/recent' },
  { key: 'usage', name: 'Usage', sub: 'AI calls and cost', here: '/usage', app: '/web/usage' },
  { key: 'settings', name: 'Settings', sub: 'Targets, Today page, reminders, devices, export', here: null, app: '/web/settings' },
];

/** Where a More row leads: its page here, or app.'s while it has none. */
export const morePlaceHref = (p: MorePlace, appUrl: string): string => p.here ?? `${appUrl}${p.app}`;

/** The Words (ideas, private entries, gratitude) stay in the full app until the journal app exists. */
export const WORDS: { key: string; name: string; app: string }[] = [
  { key: 'ideas', name: 'Ideas', app: '/web/ideas' },
  { key: 'private', name: 'Private', app: '/web/private' },
  { key: 'gratitude', name: 'Gratitude', app: '/web/gratitude' },
];

/**
 * Where a path belongs: the tab (Today for Today and the Food day; Trends for /trends and its tabs since deploy 102; Library for
 * /library and its tabs since deploy 105, the usual meals included; More for /more, Search, Recent and Usage since deploy 108, and every
 * Space) and the Space (on the PC's rail the Space itself is highlighted, on phones and tablets the More tab). `atMore`: More itself is
 * the place (the PC's rail lights it too).
 */
export type Tab = 'today' | 'trends' | 'library' | 'more';
export function placeOf(path: string): { tab: Tab | null; space: string | null; atMore: boolean } {
  const under = (p: string) => path === p || path.startsWith(`${p}/`);
  if (under('/trends')) return { tab: 'trends', space: null, atMore: false };
  if (under('/library')) return { tab: 'library', space: null, atMore: false };
  const space = SPACES.find((s) => s.href && under(s.href))?.key ?? null;
  if (space) return { tab: 'more', space, atMore: false };
  if (under('/more') || under('/search') || under('/recent') || under('/usage')) return { tab: 'more', space: null, atMore: true };
  if (path === '/' || under('/food')) return { tab: 'today', space: null, atMore: false };
  return { tab: null, space: null, atMore: false };
}

/**
 * Library's tabs (deploy 105): Foods (the food catalogue), Usual meals, Habits (the "Your habits" list of the Habits page) and
 * Exercises (the Gym's list), each its own page under /library.
 */
export type LibraryTab = 'foods' | 'usual' | 'habits' | 'exercises';
export const LIBRARY_TABS: { key: LibraryTab; label: string; href: string }[] = [
  { key: 'foods', label: 'Foods', href: '/library' },
  { key: 'usual', label: 'Usual meals', href: '/library/usual' },
  { key: 'habits', label: 'Habits', href: '/library/habits' },
  { key: 'exercises', label: 'Exercises', href: '/library/exercises' },
];

/** Medical's tabs (deploy 106): Reports, Tests over time and Medication, each its own page under /medical. */
export type MedicalTab = 'reports' | 'tests' | 'meds';
export const MEDICAL_TABS: { key: MedicalTab; label: string; href: string }[] = [
  { key: 'reports', label: 'Reports', href: '/medical' },
  { key: 'tests', label: 'Tests over time', href: '/medical/tests' },
  { key: 'meds', label: 'Medication', href: '/medical/meds' },
];
