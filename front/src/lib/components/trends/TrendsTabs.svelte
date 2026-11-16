<script lang="ts">
  import ThemeButton from '#lib/components/ThemeButton.svelte';
  import { TRENDS_TABS } from '#lib/week.js';

  // The title "Trends" with the theme button and the tabs Week · Charts · Insights (as Home's and Gym's tabs). Week is this app's
  // page; until deploy 103 Charts and Insights open app.'s pages (Food > Trends and Insights), marked "in the full app" as Home's
  // tabs were between deploys 99 and 100. Deploy 103 changes only their hrefs in TRENDS_TABS (src/lib/week.ts).
  let { appUrl, on = 'week' }: { appUrl: string; on?: string } = $props();
  const tab = 'inline-flex min-h-11 items-center gap-1 border-b-2 px-3 text-sm font-medium whitespace-nowrap no-underline desktop:min-h-10';
</script>

<header class="flex flex-col gap-1.5">
  <div class="flex items-center gap-2">
    <h1 class="m-0 flex-1 text-[26px] leading-[1.1] font-semibold tracking-tight desktop:text-[30px]">Trends</h1>
    <ThemeButton />
  </div>
  <nav aria-label="Trends" class="relative -mx-3.5 overflow-x-auto px-3.5 desktop:mx-0 desktop:px-0" data-tabs>
    <div class="flex w-max min-w-full gap-0.5 border-b border-line">
      {#each TRENDS_TABS as t (t.key)}
        {#if t.href}
          <a
            href={t.href}
            aria-current={t.key === on ? 'page' : undefined}
            class="{tab} {t.key === on ? 'border-text text-text' : 'border-transparent text-muted hover:text-text'}"
            data-tab={t.key}>{t.label}</a
          >
        {:else}
          <a href="{appUrl}{t.app}" title="In the full app" class="{tab} border-transparent text-muted hover:text-text" data-tab={t.key}
            >{t.label}<span class="sr-only">, in the full app</span><span aria-hidden="true" class="text-xs">↗</span></a
          >
        {/if}
      {/each}
    </div>
  </nav>
</header>
