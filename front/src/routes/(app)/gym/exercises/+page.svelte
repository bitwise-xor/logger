<script lang="ts">
  import ProblemCard from '#lib/components/ProblemCard.svelte';
  import ExerciseList from '#lib/components/gym/ExerciseList.svelte';
  import GymDock from '#lib/components/gym/GymDock.svelte';
  import GymHeader from '#lib/components/gym/GymHeader.svelte';
  import { ExercisesPage, setExercisesPage } from '#lib/exercisespage.svelte.js';
  import { untrack } from 'svelte';
  import type { PageProps } from './$types';

  let { data }: PageProps = $props();

  // The Gym's Exercises part (deploy 97): app.'s Exercises tab in the new look, every change saving in place. Every exercise with its
  // kind, "also: words" and "n workouts, last dd.mm." (or "not done yet"), Rename, Retire or Bring back, and "+ New exercise".
  const page = setExercisesPage(untrack(() => new ExercisesPage(data.exercises)));
  $effect.pre(() => page.load(data.exercises));

  const e = $derived(page.exercises);
</script>

<svelte:head><title>Gym exercises · Logger</title></svelte:head>

<GymHeader on="exercises" />

{#if !e}
  <ProblemCard kind={data.problem ?? 'trouble'} appHref="{data.appUrl}/web/gym/exercises" />
{:else}
  <main class="flex flex-col gap-3 desktop:gap-4">
    <ExerciseList {e} />
  </main>
{/if}

<GymDock answers={page} />
