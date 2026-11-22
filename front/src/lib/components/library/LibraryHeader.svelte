<script lang="ts">
  import ThemeButton from '#lib/components/ThemeButton.svelte';
  import { LIBRARY_TABS, type LibraryTab } from '#lib/places.js';

  // The title "Library" with the theme button and the tabs Foods · Usual meals · Habits · Exercises (deploy 105, as Trends' tabs):
  // each tab is its own page of this app; `on` is the one you are in. `hidden` hides the header on phones and tablets (the Usual
  // meals page while a meal is open there: the meal is its own screen). The words review (/library/words) is a page under Foods, reached by "Review words" there, with Foods lit.
  let { on, hidden = false }: { on: LibraryTab; hidden?: boolean } = $props();
  const tab = 'inline-flex min-h-11 items-center gap-1 border-b-2 px-3 text-sm font-medium whitespace-nowrap no-underline desktop:min-h-10';
</script>

<header class="flex-col gap-1.5 desktop:flex {hidden ? 'hidden' : 'flex'}" data-library-header>
  <div class="flex items-center gap-2">
    <h1 class="m-0 flex-1 text-[26px] leading-[1.1] font-semibold tracking-tight desktop:text-[30px]">Library</h1>
    <ThemeButton />
  </div>
  <nav aria-label="Library" class="relative -mx-3.5 overflow-x-auto px-3.5 desktop:mx-0 desktop:px-0" data-tabs>
    <div class="flex w-max min-w-full gap-0.5 border-b border-line">
      {#each LIBRARY_TABS as t (t.key)}
        <a
          href={t.href}
          aria-current={t.key === on ? 'page' : undefined}
          class="{tab} {t.key === on ? 'border-text text-text' : 'border-transparent text-muted hover:text-text'}"
          data-tab={t.key}>{t.label}</a
        >
      {/each}
    </div>
  </nav>
</header>
