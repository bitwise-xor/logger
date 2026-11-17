<script lang="ts">
  import CoachDayCard from '#lib/components/coach/CoachDayCard.svelte';
  import ThemeButton from '#lib/components/ThemeButton.svelte';
  import Chips from '#lib/components/today/Chips.svelte';
  import DayTimeline from '#lib/components/today/DayTimeline.svelte';
  import EnergyCard from '#lib/components/today/EnergyCard.svelte';
  import GratitudeLink from '#lib/components/today/GratitudeLink.svelte';
  import GymCard from '#lib/components/today/GymCard.svelte';
  import HabitsCard from '#lib/components/today/HabitsCard.svelte';
  import HealthCard from '#lib/components/today/HealthCard.svelte';
  import HomeCard from '#lib/components/today/HomeCard.svelte';
  import NeedsCard from '#lib/components/today/NeedsCard.svelte';
  import ProblemCard from '#lib/components/ProblemCard.svelte';
  import { Button } from '#lib/components/ui/button/index.js';
  import LogBox from '#lib/components/today/LogBox.svelte';
  import { todayFields } from '#lib/coach.js';
  import { pollWhileWorking } from '#lib/coachpoll.svelte.js';
  import { gratitudeShown, headerLine } from '#lib/day.js';
  import { dayLine } from '#lib/format.js';
  import { setToday, Today } from '#lib/today.svelte.js';
  import { invalidateAll } from '$app/navigation';
  import { onMount, untrack } from 'svelte';
  import type { PageProps } from './$types';

  let { data }: PageProps = $props();

  // Step C: the taps save in place; a save's answer brings the fresh day, which replaces the loaded one (src/lib/today.svelte.ts).
  // Step D: the logging box (LogBox.svelte), above the tab bar on phones, at the top on the PC; the answer bar is drawn in it.
  // The first load is drawn on the server too; later loads (after a sign-in) come through the effect.
  const today = setToday(untrack(() => new Today(data.day, data.undo)));
  $effect.pre(() => today.load(data.day, data.undo));
  onMount(() => void today.resend());

  const day = $derived(today.day);
  const coach = $derived(day?.coach ?? null);

  // Today's Coach card (deploy 109): while the day is read, ask every 5 seconds (through this app's /coach/status) and read Today again
  // in place when it is ready; after 5 minutes it says it takes longer, with Look again.
  let again = $state(0);
  pollWhileWorking({
    id: () => (coach?.state === 'working' ? coach.id : null),
    again: () => again,
    over: () => void invalidateAll(),
    slow: (on) => (today.coach.slow = on),
  });
  const lookAgain = () => {
    today.coach.slow = false;
    again++;
    void invalidateAll();
  };
  // The Food day (step E, deploy 84): its own page under Today.
  const foodHref = '/food';
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

<!-- Without the day (the door off, the core down) there is nothing to log into: the box waits for the page to load again. -->
{#if day}<LogBox />{/if}

{#if !day}
  <ProblemCard kind={data.problem ?? 'trouble'} appHref="{data.appUrl}/web/" />
{:else}
  <!-- Phones: one column in the order below (order-*): Needs you, Energy, the chips, Your day, Habits, Health, Gym, Home, Coach,
       Gratitude (the owner, 17.11.2026). The PC: the chips and the day on the left, taking all the room the right column leaves; on
       the right, top to bottom, Needs you, Energy, Habits, Health, Gym, Home, Coach and Gratitude. The two column boxes are
       display: contents on phones, so their cards join one list. -->
  <main class="flex flex-col gap-3 desktop:flex-row desktop:items-start desktop:gap-5">
    <div class="contents desktop:flex desktop:min-w-0 desktop:flex-1 desktop:flex-col desktop:gap-4">
      <div class="order-3 empty:hidden desktop:order-none"><Chips {day} /></div>
      <div class="order-4 empty:hidden desktop:order-none"><DayTimeline {day} /></div>
    </div>
    <div class="contents desktop:flex desktop:w-[340px] desktop:min-w-0 desktop:flex-none desktop:flex-col desktop:gap-4">
      <div class="order-1 empty:hidden desktop:order-none"><NeedsCard {day} appUrl={data.appUrl} /></div>
      <div class="order-2 empty:hidden desktop:order-none"><EnergyCard {day} {foodHref} /></div>
      <div class="order-5 empty:hidden desktop:order-none"><HabitsCard {day} /></div>
      <div class="order-6 empty:hidden desktop:order-none"><HealthCard {day} /></div>
      <!-- the Gym card (deploy 96) and the Home card (deploy 99) -->
      <div class="order-7 empty:hidden desktop:order-none"><GymCard {day} /></div>
      <div class="order-8 empty:hidden desktop:order-none"><HomeCard {day} /></div>
      <!-- the Coach card (deploy 109); none when Settings hides it (day.coach null) -->
      <div class="order-9 empty:hidden desktop:order-none">{#if coach}<CoachDayCard card={coach} run={today.coach} fields={todayFields(coach)} start={(f) => void today.startCoach(f)} {lookAgain} appUrl={data.appUrl} title={coach.title} links />{/if}</div>
      <!-- the Gratitude card (at app.); none when Settings > Today page hides it (deploy 111: day.shown.gratitude false) -->
      <div class="order-10 empty:hidden desktop:order-none">{#if gratitudeShown(day)}<GratitudeLink {day} href="{data.appUrl}/web/gratitude" />{/if}</div>
    </div>
  </main>
{/if}
