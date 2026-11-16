<script lang="ts">
  import ThemeButton from '#lib/components/ThemeButton.svelte';
  import FoodRows from '#lib/components/food/FoodRows.svelte';
  import FoodTiles from '#lib/components/food/FoodTiles.svelte';
  import AnswerBar from '#lib/components/today/AnswerBar.svelte';
  import { dayLinks } from '#lib/food.js';
  import { dayOf } from '#lib/format.js';
  import { FoodPage, setFoodPage } from '#lib/foodday.svelte.js';
  import { onMount, tick, untrack } from 'svelte';
  import type { PageProps } from './$types';

  let { data }: PageProps = $props();

  // Step E (deploy 84): the Food day under Today (the Energy card's "Food day", a food row on Today). Saves change the page in
  // place (src/lib/foodday.svelte.ts); another day is another load (?day=). The logging box stays on Today (the mockup's Food
  // page has none: "+ Add food" leads to it).
  const food = setFoodPage(untrack(() => new FoodPage(data.foodDay, data.undo, data.open)));
  $effect.pre(() => food.load(data.foodDay, data.undo, data.open));

  const fd = $derived(food.day);
  const links = $derived(fd ? dayLinks(fd) : null);

  // A row opened from Today: in view.
  onMount(async () => {
    if (!food.open) return;
    await tick();
    document.querySelector(`[data-row="${food.open}"]`)?.scrollIntoView({ block: 'center' });
  });

  const square =
    'flex size-11 shrink-0 items-center justify-center rounded-lg border border-line bg-panel p-0 text-lg text-text no-underline desktop:size-9 desktop:text-base';
  const pill = 'inline-flex min-h-11 items-center rounded-full px-4 no-underline';
</script>

<svelte:head><title>Food · Logger</title></svelte:head>

<header class="flex flex-col gap-0.5 desktop:flex-row desktop:flex-wrap desktop:items-center desktop:gap-3">
  <div class="flex flex-col gap-0.5 desktop:flex-1">
    <a href="/" class="inline-flex min-h-11 items-center self-start font-medium no-underline desktop:min-h-0 desktop:text-[13px]">‹ Today</a>
    <div class="flex items-center gap-2">
      <h1 class="m-0 flex-1 text-[26px] leading-[1.1] font-semibold tracking-tight desktop:text-[30px]">Food</h1>
      <span class="desktop:hidden"><ThemeButton /></span>
    </div>
  </div>
  {#if fd && links}
    <nav aria-label="Day" class="flex items-center gap-2 pt-1 desktop:pt-0">
      <a href={links.before} class={square} aria-label="The day before" data-day-before>‹</a>
      <span class="flex-1 text-center font-medium whitespace-nowrap desktop:flex-none" data-day
        >{dayOf(fd.day).slice(0, 4)}<span class="num">{dayOf(fd.day).slice(4)}</span>{fd.past ? '' : ' · today'}</span
      >
      {#if links.after}
        <a href={links.after} class={square} aria-label="The day after" data-day-after>›</a>
      {:else}
        <span class="{square} cursor-default text-muted opacity-50" aria-disabled="true" aria-label="The day after">›</span>
      {/if}
      <a href="/#log-text" class="ml-2 hidden min-h-9 items-center rounded-lg bg-text px-4 font-medium text-bg no-underline desktop:inline-flex"
        >+ Add food</a
      >
      <span class="hidden desktop:inline"><ThemeButton /></span>
    </nav>
  {/if}
</header>

{#if !fd}
  <p role="alert" class="m-0 rounded-card border border-line bg-panel p-3.5">
    {data.problem} The <a href="{data.appUrl}/web/food">full app</a> may still work.
  </p>
{:else}
  <main class="flex flex-col gap-3 desktop:gap-4">
    <FoodTiles day={fd} />
    <FoodRows day={fd} />
    <div class="flex flex-wrap gap-1.5">
      <a href="/#log-text" class="{pill} bg-text font-medium text-bg desktop:hidden">+ Add food</a>
      <a href="{data.appUrl}/web/food/usual" class="{pill} border border-line bg-panel text-text desktop:min-h-9">Usual meals: full app</a>
    </div>
  </main>
{/if}

<!-- The answer bar: above the tab bar on phones (no logging box here), at the bottom right on the PC. -->
<div class="pointer-events-none fixed inset-x-0 bottom-[calc(52px+env(safe-area-inset-bottom))] z-20 px-3.5 pb-2 desktop:static desktop:p-0">
  <AnswerBar answers={food} />
</div>
