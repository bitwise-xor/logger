<script lang="ts">
  import ThemeButton from '#lib/components/ThemeButton.svelte';
  import Chips from '#lib/components/today/Chips.svelte';
  import DayTimeline from '#lib/components/today/DayTimeline.svelte';
  import EnergyCard from '#lib/components/today/EnergyCard.svelte';
  import GratitudeLink from '#lib/components/today/GratitudeLink.svelte';
  import HabitsCard from '#lib/components/today/HabitsCard.svelte';
  import HealthCard from '#lib/components/today/HealthCard.svelte';
  import NeedsCard from '#lib/components/today/NeedsCard.svelte';
  import { Button } from '#lib/components/ui/button/index.js';
  import AnswerBar from '#lib/components/today/AnswerBar.svelte';
  import { headerLine } from '#lib/day.js';
  import { dayLine } from '#lib/format.js';
  import { setToday, Today } from '#lib/today.svelte.js';
  import { onMount, untrack } from 'svelte';
  import type { PageProps } from './$types';

  let { data }: PageProps = $props();

  // Step C: the taps save in place; a save's answer brings the fresh day, which replaces the loaded one (src/lib/today.svelte.ts).
  // The first load is drawn on the server too; later loads (after a sign-in) come through the effect.
  const today = setToday(untrack(() => new Today(data.day, data.undo)));
  $effect.pre(() => today.load(data.day, data.undo));
  onMount(() => void today.resend());

  const day = $derived(today.day);
  // The Food day is app.'s until step E (deploy 82) brings it here.
  const foodHref = $derived(day ? `${data.appUrl}/web/food?day=${day.day}` : `${data.appUrl}/web/food`);
</script>

<svelte:head><title>Today · Logger</title></svelte:head>

<header class="flex items-center gap-2.5">
  <div class="flex min-w-0 flex-1 flex-col gap-0.5 desktop:flex-row desktop:items-baseline desktop:gap-3">
    <h1 class="m-0 text-[26px] leading-[1.1] font-semibold tracking-tight desktop:text-[30px]">Today</h1>
    <span class="text-[13px] text-muted" data-header>{day ? headerLine(day) : dayLine(new Date())}</span>
  </div>
  <ThemeButton />
  <form method="POST" action="/signout" class="m-0">
    <Button type="submit" variant="outline">Sign out</Button>
  </form>
</header>

{#if !day}
  <p role="alert" class="m-0 rounded-card border border-line bg-panel p-3.5">
    {data.problem} The <a href="{data.appUrl}/web/">full app</a> may still work.
  </p>
{:else}
  <!-- Phones: one column in the order below (order-*). The PC: the day on the left, what needs you and the numbers on the right
       (the mockup's TodayDesktop). The two column boxes are display: contents on phones, so their cards join one list. -->
  <main class="flex flex-col gap-3 desktop:flex-row desktop:items-start desktop:gap-5">
    <div class="contents desktop:flex desktop:min-w-0 desktop:flex-[3_1_420px] desktop:flex-col desktop:gap-4">
      <div class="order-3 empty:hidden desktop:order-none"><Chips {day} /></div>
      <div class="order-4 empty:hidden desktop:order-none"><DayTimeline {day} /></div>
      <div class="order-5 empty:hidden desktop:order-none"><HealthCard {day} /></div>
    </div>
    <div class="contents desktop:flex desktop:min-w-0 desktop:flex-[2_1_300px] desktop:flex-col desktop:gap-4">
      <div class="order-1 empty:hidden desktop:order-none"><NeedsCard {day} appUrl={data.appUrl} /></div>
      <div class="order-2 empty:hidden desktop:order-none"><EnergyCard {day} {foodHref} /></div>
      <div class="order-6 empty:hidden desktop:order-none"><HabitsCard {day} /></div>
      <div class="order-7 empty:hidden desktop:order-none"><GratitudeLink {day} href="{data.appUrl}/web/gratitude" /></div>
    </div>
  </main>
{/if}
<!-- Room for the answer bar, so it never covers the last card. -->
{#if today.bar}<div class="h-16 shrink-0" aria-hidden="true"></div>{/if}
<AnswerBar />
