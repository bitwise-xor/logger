<script lang="ts">
  import ThemeButton from '#lib/components/ThemeButton.svelte';
  import { SETTINGS_TABS, type SettingsTab } from '#lib/places.js';

  // Settings' header (deploy 111): a back chevron to More, the title, the theme button, and the seven tabs in a row (each its own page
  // under /settings; `on` is the one you are in). On phones the row scrolls sideways inside itself, never the page.
  let { on }: { on: SettingsTab } = $props();
  const tab = 'inline-flex min-h-11 items-center border-b-2 px-3 text-sm font-medium whitespace-nowrap no-underline desktop:min-h-10';
</script>

<header class="flex flex-col gap-1" data-settings-header>
  <div class="flex items-center gap-1.5">
    <a
      href="/more"
      aria-label="Back to More"
      title="Back to More"
      class="-ml-3 flex size-11 shrink-0 items-center justify-center rounded-lg text-text no-underline hover:bg-panel2 desktop:ml-0"
      data-back
    >
      <svg aria-hidden="true" width="20" height="20" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"
        ><path d="M10 3.5L5.5 8l4.5 4.5"></path></svg
      >
    </a>
    <h1 class="m-0 min-w-0 flex-1 text-[26px] leading-[1.1] font-semibold tracking-tight desktop:text-[30px]">Settings</h1>
    <ThemeButton />
  </div>
  <nav aria-label="Settings" class="relative -mx-3.5 overflow-x-auto px-3.5 [scrollbar-width:none] desktop:mx-0 desktop:px-0" data-tabs>
    <div class="flex w-max min-w-full gap-0.5 border-b border-line">
      {#each SETTINGS_TABS as t (t.key)}
        <a
          href={t.href}
          aria-current={t.key === on ? 'page' : undefined}
          class="{tab} {t.key === on ? 'border-blue text-blue' : 'border-transparent text-muted hover:text-text'}"
          data-tab={t.key}>{t.label}</a
        >
      {/each}
    </div>
  </nav>
</header>
