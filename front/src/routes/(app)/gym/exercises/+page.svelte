<script lang="ts">
  import ProblemCard from '#lib/components/ProblemCard.svelte';
  import ExerciseItem from '#lib/components/gym/ExerciseItem.svelte';
  import ExerciseNew from '#lib/components/gym/ExerciseNew.svelte';
  import GymDock from '#lib/components/gym/GymDock.svelte';
  import GymHeader from '#lib/components/gym/GymHeader.svelte';
  import { ExercisesPage, setExercisesPage } from '#lib/exercisespage.svelte.js';
  import { activeLine } from '#lib/gymplan.js';
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
    <section aria-labelledby="ex-h" class="flex min-w-0 flex-col gap-2.5 rounded-card border border-line bg-panel p-3 desktop:p-3.5" data-card="exercises">
      <div class="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
        <h2 id="ex-h" class="m-0 text-lg font-semibold tracking-tight">Your exercises</h2>
        <span class="num text-[13px] text-muted" data-count>{activeLine(e)}</span>
      </div>
      <div class="grid items-start gap-2 desktop:grid-cols-2" data-list>
        {#each e.exercises as x (x.exercise_id)}
          <ExerciseItem {x} />
        {:else}
          <p class="m-0 text-muted desktop:col-span-2" data-empty>No exercises yet.</p>
        {/each}
      </div>
      <ExerciseNew />
    </section>
  </main>
{/if}

<GymDock answers={page} />
