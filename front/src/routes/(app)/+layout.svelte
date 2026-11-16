<script lang="ts">
  import type { LayoutProps } from './$types';

  let { data, children }: LayoutProps = $props();

  // Only Today works in the trial; the others are greyed out (the plan, question 2).
  const places = [
    { name: 'Today', live: true },
    { name: 'Trends', live: false },
    { name: 'Library', live: false },
    { name: 'More', live: false },
  ];
</script>

<div class="flex min-h-dvh flex-col desktop:flex-row">
  <!-- The PC: a rail on the left. Phones and tablets: the tab bar at the bottom. -->
  <nav
    aria-label="Places"
    class="fixed inset-x-0 bottom-0 z-10 grid grid-cols-4 border-t border-line bg-bg px-2 pb-[env(safe-area-inset-bottom)] desktop:static desktop:flex desktop:w-[220px] desktop:shrink-0 desktop:flex-col desktop:gap-0.5 desktop:border-t-0 desktop:px-3 desktop:py-[18px]"
  >
    <span class="hidden px-2.5 pb-3 text-[15px] font-semibold tracking-tight desktop:block">Logger</span>
    {#each places as place (place.name)}
      {#if place.live}
        <a
          href="/"
          aria-current="page"
          class="flex h-[52px] items-center justify-center text-[13px] font-medium text-blue no-underline desktop:h-9 desktop:justify-start desktop:rounded-lg desktop:bg-blue-bg desktop:px-2.5 desktop:text-sm"
          >{place.name}</a
        >
      {:else}
        <span
          aria-disabled="true"
          title="In the full app"
          class="flex h-[52px] cursor-default items-center justify-center text-[13px] font-medium text-muted opacity-50 desktop:h-9 desktop:justify-start desktop:px-2.5 desktop:text-sm"
          >{place.name}</span
        >
      {/if}
    {/each}
  </nav>

  <div class="mx-auto flex w-full max-w-[960px] min-w-0 flex-1 flex-col gap-3 px-3.5 pt-3.5 pb-[calc(84px+var(--dock,0px))] desktop:px-6 desktop:pb-8">
    {#if data.problem}
      <p role="alert" class="m-0 rounded-card border border-line bg-panel p-3.5">
        {data.problem} The <a href="{data.appUrl}/web/">full app</a> may still work.
      </p>
    {/if}
    {@render children()}
    <p class="m-0 mt-auto pt-6 text-[13px] text-muted">
      Trends, Library and More are <a href="{data.appUrl}/web/">in the full app</a>.
    </p>
  </div>
</div>
