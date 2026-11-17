<script lang="ts">
  import ExerciseItem from '#lib/components/gym/ExerciseItem.svelte';
  import ExerciseNew from '#lib/components/gym/ExerciseNew.svelte';
  import { activeLine, type Exercises } from '#lib/gymplan.js';

  // "Your exercises" (deploy 97; shared with Library's Exercises tab since deploy 105): every exercise with Rename and Retire or Bring
  // back, and "+ New exercise". The page sets the ExercisesPage this reads.
  let { e }: { e: Exercises } = $props();
</script>

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
