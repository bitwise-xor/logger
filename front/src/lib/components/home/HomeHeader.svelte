<script lang="ts">
  import ThemeButton from '#lib/components/ThemeButton.svelte';
  import { TABS } from '#lib/home.js';

  // The title "Home" with the theme button and the tabs Now · Zones · History (the mockup's row under the title), all pages of this
  // app since deploy 100. `on` is the tab that is lit: Zones also on a chore's page and on Edit zones.
  let { on = 'now' }: { on?: string } = $props();
</script>

<header class="flex flex-col gap-1.5">
  <div class="flex items-center gap-2">
    <h1 class="m-0 flex-1 text-[26px] leading-[1.1] font-semibold tracking-tight desktop:text-[30px]">Home</h1>
    <ThemeButton />
  </div>
  <nav aria-label="Home" class="relative -mx-3.5 overflow-x-auto px-3.5 desktop:mx-0 desktop:px-0" data-tabs>
    <div class="flex w-max min-w-full gap-0.5 border-b border-line">
      {#each TABS as t (t.key)}
        <a
          href={t.href}
          aria-current={t.key === on ? 'page' : undefined}
          class="inline-flex min-h-11 items-center border-b-2 px-3 text-sm font-medium whitespace-nowrap no-underline desktop:min-h-10 {t.key === on
            ? 'border-text text-text'
            : 'border-transparent text-muted hover:text-text'}"
          data-tab={t.key}>{t.label}</a
        >
      {/each}
    </div>
  </nav>
</header>
