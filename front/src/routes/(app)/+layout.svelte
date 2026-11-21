<script lang="ts">
  import { invalidateAll } from '$app/navigation';
  import { navigating, page } from '$app/state';
  import { Comeback, OPEN, SURVIVES, TEXT_FIELD } from '#lib/comeback.js';
  import { placeOf, SPACES } from '#lib/places.js';
  import { savesInFlight } from '#lib/saver.js';
  import type { LayoutProps } from './$types';

  let { children }: LayoutProps = $props();

  // Web 68: a page that takes longer than about 150 ms to come shows a thin bar at the top (app.css, .loading-bar), so a tap on a
  // slow phone network is seen to have done something. app.html starts the page's read when the finger goes down (preload "tap").
  let slow = $state(false);
  $effect(() => {
    if (!navigating.to) {
      slow = false;
      return;
    }
    const timer = setTimeout(() => (slow = true), 150);
    return () => clearTimeout(timer);
  });

  // Web 67: back on the screen after a minute or more, the page reads its data again (invalidateAll), unless a save is on its way,
  // something was typed or something is open (src/lib/comeback.ts says why each would be lost).
  $effect(() => {
    const comeback = new Comeback();
    const typed = new Set<Element>();
    const keep = (e: Event) => {
      if (e.target instanceof Element && e.target.matches(TEXT_FIELD) && !e.target.closest(SURVIVES)) typed.add(e.target);
    };
    const probe = {
      inFlight: savesInFlight,
      focused: () => {
        const a = document.activeElement;
        return !!a && a.matches(TEXT_FIELD) && !a.closest(SURVIVES);
      },
      // typed into, still on the page and not empty (a form emptied after its save no longer counts)
      typed: () => {
        for (const el of typed) if (!el.isConnected) typed.delete(el);
        return [...typed].some((el) => !(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) || el.value !== '');
      },
      open: () => [...document.querySelectorAll(OPEN)].some((el) => !el.closest(`${SURVIVES}, [data-places]`)),
    };
    // a form sent: its words went with it (its answer brings the fresh read)
    const sent = (e: Event) => {
      if (e.target instanceof HTMLFormElement) for (const el of typed) if (e.target.contains(el)) typed.delete(el);
    };
    const seen = () => {
      if (document.visibilityState === 'hidden') comeback.hidden();
      else if (comeback.visible(probe)) void invalidateAll();
    };
    document.addEventListener('visibilitychange', seen);
    document.addEventListener('input', keep, true);
    document.addEventListener('change', keep, true);
    document.addEventListener('submit', sent, true);
    return () => {
      document.removeEventListener('visibilitychange', seen);
      document.removeEventListener('input', keep, true);
      document.removeEventListener('change', keep, true);
      document.removeEventListener('submit', sent, true);
    };
  });

  // The places (deploy 96, the Spaces menu): the PC's rail has Today, Trends, Library, then "Spaces" (Gym, Health, Habits, Home, Medical), then
  // More; the Space you are in is the highlighted one. Phones and tablets keep four tabs, Today, Trends, Library and More; More is
  // the page /more with the Spaces, and it is highlighted on a Space's page too. Trends is a page of this app since deploy 102 (lit on
  // every /trends page), Library since deploy 105 (lit on every /library page). Search, Recent and Usage (deploy 108), Coach (109) and
  // Settings (111) are pages under More: More is lit on them, on the PC's rail too. Since deploy 111 no footer line sends you to app.
  // (what stays there is linked where it is: the Words on More, the Gratitude card, a failed read's "Open the full app").
  const here = $derived(placeOf(page.url.pathname));

  const tab = 'flex h-[52px] items-center justify-center text-[13px] font-medium no-underline desktop:h-9 desktop:justify-start desktop:rounded-lg desktop:px-2.5 desktop:text-sm';
  const on = 'text-blue desktop:bg-blue-bg';
  const off = 'text-muted desktop:text-text desktop:hover:bg-panel2';
  // a Space on the rail: the PC only
  const rail = 'hidden h-9 items-center rounded-lg px-2.5 text-sm font-medium no-underline desktop:flex';
</script>

{#if slow}<div class="loading-bar" role="progressbar" aria-label="Loading the page" data-loading></div>{/if}

<div class="flex min-h-dvh flex-col desktop:flex-row">
  <!-- The PC: a rail on the left. Phones and tablets: the tab bar at the bottom. -->
  <nav
    aria-label="Places"
    class="fixed inset-x-0 bottom-0 z-10 grid grid-cols-4 border-t border-line bg-bg px-2 pb-[env(safe-area-inset-bottom)] desktop:static desktop:flex desktop:w-[220px] desktop:shrink-0 desktop:flex-col desktop:gap-0.5 desktop:border-t-0 desktop:px-3 desktop:py-[18px]"
    data-places
    data-chrome
  >
    <span class="hidden px-2.5 pb-3 text-[15px] font-semibold tracking-tight desktop:block">Logger</span>
    <a href="/" aria-current={here.tab === 'today' ? (page.url.pathname === '/' ? 'page' : 'true') : undefined} class="{tab} {here.tab === 'today' ? on : off}" data-place="today">Today</a>
    <a href="/trends" aria-current={here.tab === 'trends' ? (page.url.pathname === '/trends' ? 'page' : 'true') : undefined} class="{tab} {here.tab === 'trends' ? on : off}" data-place="trends">Trends</a>
    <a href="/library" aria-current={here.tab === 'library' ? (page.url.pathname === '/library' ? 'page' : 'true') : undefined} class="{tab} {here.tab === 'library' ? on : off}" data-place="library">Library</a>
    <!-- The Spaces, on the PC only (phones and tablets find them under More). -->
    <span class="hidden px-2.5 pt-4 pb-1 text-xs font-medium tracking-wider text-muted uppercase desktop:block" data-rail-group>Spaces</span>
    {#each SPACES.filter((s) => s.href) as s (s.key)}
      <a
        href={s.href}
        aria-current={here.space === s.key ? 'page' : undefined}
        class="{rail} {here.space === s.key ? 'bg-blue-bg text-blue' : 'text-text hover:bg-panel2'}"
        data-rail-space={s.key}>{s.name}</a
      >
    {/each}
    <span class="hidden pt-3 desktop:block" aria-hidden="true"></span>
    <!-- More: highlighted on its page, and on phones and tablets also on a Space's page (the PC highlights the Space itself). -->
    <a
      href="/more"
      aria-current={here.atMore ? (page.url.pathname === '/more' ? 'page' : 'true') : here.tab === 'more' ? 'true' : undefined}
      class="{tab} {here.atMore ? on : here.tab === 'more' ? 'text-blue desktop:text-text desktop:hover:bg-panel2' : off}"
      data-place="more">More</a
    >
  </nav>

  <div class="mx-auto flex w-full max-w-[960px] min-w-0 flex-1 flex-col desktop:mx-0 desktop:max-w-[1440px] gap-3 px-3.5 pt-3.5 pb-[calc(var(--places-room)+var(--dock,0px))] desktop:px-6 desktop:pb-8">
    {@render children()}
  </div>
</div>
