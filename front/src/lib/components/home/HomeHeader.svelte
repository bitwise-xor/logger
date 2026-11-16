<script lang="ts">
  import ThemeButton from '#lib/components/ThemeButton.svelte';
  import { TABS } from '#lib/home.js';

  // The title "Home" with the theme button and the tabs Now · Zones · History (the mockup's row under the title). Now is this app's
  // page; until deploy 100 Zones and History open app.'s pages, marked "in the full app" as Gym's parts were in deploy 96.
  let { appUrl, on = 'now' }: { appUrl: string; on?: string } = $props();
</script>

<header class="flex flex-col gap-1.5">
  <div class="flex items-center gap-2">
    <h1 class="m-0 flex-1 text-[26px] leading-[1.1] font-semibold tracking-tight desktop:text-[30px]">Home</h1>
    <ThemeButton />
  </div>
  <nav aria-label="Home" class="relative -mx-3.5 overflow-x-auto px-3.5 desktop:mx-0 desktop:px-0" data-tabs>
    <div class="flex w-max min-w-full gap-0.5 border-b border-line">
      {#each TABS as t (t.key)}
        {#if t.href}
          <a
            href={t.href}
            aria-current={t.key === on ? 'page' : undefined}
            class="inline-flex min-h-11 items-center border-b-2 px-3 text-sm font-medium whitespace-nowrap no-underline desktop:min-h-10 {t.key === on
              ? 'border-text text-text'
              : 'border-transparent text-muted hover:text-text'}"
            data-tab={t.key}>{t.label}</a
          >
        {:else}
          <a
            href="{appUrl}{t.app}"
            title="In the full app"
            class="inline-flex min-h-11 items-center gap-1 border-b-2 border-transparent px-3 text-sm font-medium whitespace-nowrap text-muted no-underline hover:text-text desktop:min-h-10"
            data-tab={t.key}
            >{t.label}<span class="sr-only">, in the full app</span><span aria-hidden="true" class="text-xs">↗</span></a
          >
        {/if}
      {/each}
    </div>
  </nav>
</header>
