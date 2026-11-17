<script lang="ts">
  import ProblemCard from '#lib/components/ProblemCard.svelte';
  import HabitList from '#lib/components/habits/HabitList.svelte';
  import GymDock from '#lib/components/gym/GymDock.svelte';
  import LibraryHeader from '#lib/components/library/LibraryHeader.svelte';
  import { HabitsPage, setHabitsPage } from '#lib/habitspage.svelte.js';
  import { untrack } from 'svelte';
  import type { PageProps } from './$types';

  let { data }: PageProps = $props();

  // Library's Habits tab (deploy 105): the Habits page's "Your habits" card (the filter, the habits by group, Track, Edit, Retire or
  // Bring back, Delete, + New habit), the same state and saves (HabitsPage with this page's path). Today's ticks and the 30 days stay
  // on the Habits page. One column of a readable width at every size.
  const page = setHabitsPage(untrack(() => new HabitsPage(data.habits, data.undo, '/library/habits')));
  $effect.pre(() => page.load(data.habits, data.undo));
  const h = $derived(page.habits);
</script>

<svelte:head><title>Habits · Library · Logger</title></svelte:head>

<LibraryHeader on="habits" />

{#if !h}
  <ProblemCard kind={data.problem ?? 'trouble'} appHref="{data.appUrl}/web/habits" />
{:else}
  <main class="flex w-full flex-col gap-3 desktop:max-w-[720px]">
    <HabitList habits={h} />
    <p class="m-0 text-[13px] text-muted" data-settings-line>
      Which habits show on Today, and their order: in <a href="/settings/today">Settings</a>.
    </p>
  </main>
{/if}

<GymDock answers={page} />
