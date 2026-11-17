<script lang="ts">
  import ProblemCard from '#lib/components/ProblemCard.svelte';
  import ExerciseList from '#lib/components/gym/ExerciseList.svelte';
  import GymDock from '#lib/components/gym/GymDock.svelte';
  import LibraryHeader from '#lib/components/library/LibraryHeader.svelte';
  import { ExercisesPage, setExercisesPage } from '#lib/exercisespage.svelte.js';
  import { untrack } from 'svelte';
  import type { PageProps } from './$types';

  let { data }: PageProps = $props();

  // Library's Exercises tab (deploy 105): the Gym's exercises list (Rename, Retire or Bring back, + New exercise), the same parts and saves
  // as /gym/exercises (ExercisesPage with this page's path). The Gym keeps its own Exercises part.
  const page = setExercisesPage(untrack(() => new ExercisesPage(data.exercises, '/library/exercises')));
  $effect.pre(() => page.load(data.exercises));
  const e = $derived(page.exercises);
</script>

<svelte:head><title>Exercises · Library · Logger</title></svelte:head>

<LibraryHeader on="exercises" />

{#if !e}
  <ProblemCard kind={data.problem ?? 'trouble'} appHref="{data.appUrl}/web/gym/exercises" />
{:else}
  <main class="flex flex-col gap-3 desktop:gap-4">
    <ExerciseList {e} />
  </main>
{/if}

<GymDock answers={page} />
