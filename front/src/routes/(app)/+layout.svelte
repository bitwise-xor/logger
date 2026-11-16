<script lang="ts">
  import { page } from '$app/state';
  import { placeOf, SPACES } from '#lib/places.js';
  import type { LayoutProps } from './$types';

  let { data, children }: LayoutProps = $props();

  // The places (deploy 96, the Spaces menu): the PC's rail has Today, Trends, Library, then "Spaces" (Gym, Health, Habits, Home), then
  // More; the Space you are in is the highlighted one. Phones and tablets keep four tabs, Today, Trends, Library and More; More is
  // the page /more with the Spaces, and it is highlighted on a Space's page too. Trends and Library stay greyed (in the full app).
  const here = $derived(placeOf(page.url.pathname));

  const tab = 'flex h-[52px] items-center justify-center text-[13px] font-medium no-underline desktop:h-9 desktop:justify-start desktop:rounded-lg desktop:px-2.5 desktop:text-sm';
  const on = 'text-blue desktop:bg-blue-bg';
  const off = 'text-muted desktop:text-text desktop:hover:bg-panel2';
  // a Space on the rail: the PC only
  const rail = 'hidden h-9 items-center rounded-lg px-2.5 text-sm font-medium no-underline desktop:flex';
</script>

<div class="flex min-h-dvh flex-col desktop:flex-row">
  <!-- The PC: a rail on the left. Phones and tablets: the tab bar at the bottom. -->
  <nav
    aria-label="Places"
    class="fixed inset-x-0 bottom-0 z-10 grid grid-cols-4 border-t border-line bg-bg px-2 pb-[env(safe-area-inset-bottom)] desktop:static desktop:flex desktop:w-[220px] desktop:shrink-0 desktop:flex-col desktop:gap-0.5 desktop:border-t-0 desktop:px-3 desktop:py-[18px]"
    data-places
  >
    <span class="hidden px-2.5 pb-3 text-[15px] font-semibold tracking-tight desktop:block">Logger</span>
    <a href="/" aria-current={here.tab === 'today' ? (page.url.pathname === '/' ? 'page' : 'true') : undefined} class="{tab} {here.tab === 'today' ? on : off}" data-place="today">Today</a>
    {#each ['Trends', 'Library'] as name (name)}
      <span
        aria-disabled="true"
        title="In the full app"
        class="flex h-[52px] cursor-default items-center justify-center text-[13px] font-medium text-muted opacity-50 desktop:h-9 desktop:justify-start desktop:px-2.5 desktop:text-sm"
        data-place={name.toLowerCase()}>{name}</span
      >
    {/each}
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
      aria-current={here.atMore ? 'page' : here.tab === 'more' ? 'true' : undefined}
      class="{tab} {here.atMore ? on : here.tab === 'more' ? 'text-blue desktop:text-text desktop:hover:bg-panel2' : off}"
      data-place="more">More</a
    >
  </nav>

  <div class="mx-auto flex w-full max-w-[960px] min-w-0 flex-1 flex-col desktop:mx-0 desktop:max-w-[1440px] gap-3 px-3.5 pt-3.5 pb-[calc(84px+var(--dock,0px))] desktop:px-6 desktop:pb-8">
    {@render children()}
    <p class="m-0 mt-auto pt-6 text-[13px] text-muted">
      Trends, Library and the rest are <a href="{data.appUrl}/web/">in the full app</a>.
    </p>
  </div>
</div>
