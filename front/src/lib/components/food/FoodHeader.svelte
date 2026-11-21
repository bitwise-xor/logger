<script lang="ts">
  import ThemeButton from '#lib/components/ThemeButton.svelte';
  import { FOOD_TABS, foodTabHref, type FoodTab } from '#lib/places.js';

  // The title "Food" with two short links into Library (Foods, Usual meals), the theme button and the tabs Day · Nutrients · Notes
  // (21.11.2026, as Medical's tabs): each tab is its own page of this app; `on` is the one you are in. `day`: the day shown (null:
  // today), carried to the other tab that takes one, so Day and Nutrients look at the same day.
  let { on, day = null }: { on: FoodTab; day?: string | null } = $props();
  const tab = 'inline-flex min-h-11 items-center gap-1 border-b-2 px-3 text-sm font-medium whitespace-nowrap no-underline desktop:min-h-10';
  const lib = 'inline-flex min-h-11 items-center px-1.5 text-[13px] font-medium no-underline desktop:min-h-9';
</script>

<header class="flex flex-col gap-1.5" data-food-header>
  <div class="flex items-center gap-1">
    <h1 class="m-0 flex-1 text-[26px] leading-[1.1] font-semibold tracking-tight desktop:text-[30px]">Food</h1>
    <nav aria-label="Library" class="flex items-center" data-food-library>
      <a href="/library" class={lib} data-library-foods>Foods</a>
      <span aria-hidden="true" class="text-muted">·</span>
      <a href="/library/usual" class={lib} data-usual-link>Usual meals</a>
    </nav>
    <ThemeButton />
  </div>
  <nav aria-label="Food" class="relative -mx-3.5 overflow-x-auto px-3.5 desktop:mx-0 desktop:px-0" data-tabs>
    <div class="flex w-max min-w-full gap-0.5 border-b border-line">
      {#each FOOD_TABS as t (t.key)}
        <a
          href={foodTabHref(t.key, day)}
          aria-current={t.key === on ? 'page' : undefined}
          class="{tab} {t.key === on ? 'border-text text-text' : 'border-transparent text-muted hover:text-text'}"
          data-tab={t.key}>{t.label}</a
        >
      {/each}
    </div>
  </nav>
</header>
