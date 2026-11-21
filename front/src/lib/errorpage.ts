/**
 * The error pages (Web 66, 21.11.2026): `routes/(app)/+error.svelte` inside the app's layout (the rail or the tab bar stay, so the
 * home-screen app, which has no back button, always has a way on) and `routes/+error.svelte` for an error outside it (the sign-in
 * page, or the layout's own check). Plain words by the answer's status, never the error's own words or the address; both offer
 * "Back to Today" and "Try again" (the same address, read again).
 */
export interface ErrorWords {
  title: string;
  text: string;
}

export function errorWords(status: number): ErrorWords {
  if (status === 404) return { title: 'Not found', text: 'There is no page at this address. It may have moved, or the link was cut short.' };
  return { title: 'Something went wrong', text: 'Logger could not show this page just now. Try again, or go back to Today.' };
}
