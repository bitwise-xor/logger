<script lang="ts">
  import ProblemCard from '#lib/components/ProblemCard.svelte';
  import DaySwitch from '#lib/components/food/DaySwitch.svelte';
  import FoodHeader from '#lib/components/food/FoodHeader.svelte';
  import FoodRows from '#lib/components/food/FoodRows.svelte';
  import FoodTiles from '#lib/components/food/FoodTiles.svelte';
  import AnswerBar from '#lib/components/today/AnswerBar.svelte';
  import { dayLinks, foodDayHref } from '#lib/food.js';
  import { todayHref } from '#lib/day.js';
  import { dayOf } from '#lib/format.js';
  import { FoodPage, setFoodPage } from '#lib/foodday.svelte.js';
  import { onMount, tick, untrack } from 'svelte';
  import type { PageProps } from './$types';

  let { data }: PageProps = $props();

  // Step E (deploy 84): the Food day (the Energy card's "Food day", a food row on Today); since 21.11.2026 the Day tab of the Food
  // space (FoodHeader: Day · Nutrients · Notes, the day carried), with a date field beside ‹ and › (DaySwitch) and a note on each
  // meal. Saves change the page in place (src/lib/foodday.svelte.ts); another day is another load (?day=). The logging box stays on
  // Today (the mockup's Food page has none: "+ Add food" leads to it).
  const food = setFoodPage(untrack(() => new FoodPage(data.foodDay, data.undo, data.open)));
  $effect.pre(() => food.load(data.foodDay, data.undo, data.open));
  // A "Save as usual meal" that met a gone session: sent again after the sign-in (deploy 87).
  onMount(() => void food.resend());

  const fd = $derived(food.day);
  const links = $derived(fd ? dayLinks(fd) : null);

  // A row opened from Today: in view.
  onMount(async () => {
    if (!food.open) return;
    await tick();
    document.querySelector(`[data-row="${food.open}"]`)?.scrollIntoView({ block: 'center' });
  });

  // Step F: on phones the answer bar floats above the tab bar; the page leaves room for it (the layout's --dock, as the logging
  // box does on Today), so it never covers the last rows.
  let barHeight = $state(0);
  $effect(() => {
    document.documentElement.style.setProperty('--dock', `${barHeight}px`);
    return () => document.documentElement.style.removeProperty('--dock');
  });

  const pill = 'inline-flex min-h-11 items-center rounded-full px-4 no-underline';
</script>

<svelte:head><title>{fd?.past ? `${dayOf(fd.day)} · ` : ''}Food · Logger</title></svelte:head>

<FoodHeader on="day" day={fd?.past ? fd.day : null} />

{#if fd && links}
  <div class="flex items-center gap-2">
    <div class="min-w-0 flex-1 desktop:flex-none">
      <DaySwitch day={fd.day} today={fd.today} past={fd.past} before={links.before} after={links.after} hrefFor={(d) => foodDayHref(d, fd.today)} />
    </div>
    {#if fd.past}
      <!-- Web 69: the same day on Today (its habits, health values and Coach card) -->
      <a href={todayHref(fd.day, fd.today)} class="inline-flex min-h-11 shrink-0 items-center font-medium no-underline desktop:min-h-9" data-day-today>On Today</a>
    {/if}
    <a href="/#log-text" class="ml-auto hidden min-h-9 items-center rounded-lg bg-text px-4 font-medium text-bg no-underline desktop:inline-flex">+ Add food</a>
  </div>
{/if}

{#if !fd}
  <ProblemCard kind={data.problem ?? 'trouble'} appHref="{data.appUrl}/web/food" />
{:else}
  <main class="flex flex-col gap-3 desktop:gap-4">
    <FoodTiles day={fd} />
    <FoodRows day={fd} />
    <div class="flex flex-wrap gap-1.5 desktop:hidden">
      <a href="/#log-text" class="{pill} bg-text font-medium text-bg">+ Add food</a>
    </div>
  </main>
{/if}

<!-- The answer bar: above the tab bar on phones (no logging box here), at the bottom right on the PC. -->
<div
  bind:clientHeight={barHeight}
  class="pointer-events-none fixed inset-x-0 bottom-[var(--places-bar)] z-20 px-3.5 pb-2 desktop:static desktop:p-0"
>
  <AnswerBar answers={food} />
</div>
