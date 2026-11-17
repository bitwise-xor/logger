/**
 * While a coaching is read (a Week review, a day coaching): ask GET /coach/status?id= through this app every 5 seconds for at most
 * 5 minutes (`StatusPoll`, week.ts), and when it is no longer working read the page again in place (`over`); after 5 minutes say it
 * takes longer (`slow(true)`, with Look again: `again()` changes and the poll starts over). Call it once while the page is made
 * (it sets up an effect). Trends, the Coach page and Today use it.
 */
import { goto } from '$app/navigation';
import { untrack } from 'svelte';
import { loginHref } from './next.js';
import { StatusPoll, statusOf } from './week.js';

export interface PollWhile {
  /** The id of the coaching being read, or null when nothing is being read. */
  id: () => number | null | undefined;
  /** A counter the page bumps for "Look again". */
  again: () => number;
  over: () => void;
  slow: (on: boolean) => void;
}

export function pollWhileWorking(d: PollWhile) {
  $effect(() => {
    const id = d.id();
    void d.again();
    if (id === null || id === undefined) return;
    const poll = new StatusPoll({
      ask: async () => {
        const r = await fetch(`/coach/status?id=${id}`, { cache: 'no-store', headers: { accept: 'application/json' } });
        return statusOf(r.status, await r.json().catch(() => null));
      },
      over: () => d.over(),
      signedOut: () => void goto(loginHref(location.pathname + location.search)),
      slow: () => d.slow(true),
    });
    untrack(() => d.slow(false));
    poll.start();
    return () => poll.stop();
  });
}
