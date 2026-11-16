<script lang="ts">
  import type { Progress } from '#lib/gymread.js';

  // The exercise chips of the Progress read (the read's order: the most recently done first), each a link to `hrefOf(id)`: /gym/progress
  // on the Gym's Progress part, /trends/charts (the range kept) on Trends' Charts tab.
  let { exercises, hrefOf }: { exercises: Progress['exercises']; hrefOf: (id: number) => string } = $props();
</script>

<div role="group" aria-label="Exercise" class="flex flex-wrap gap-1.5" data-chips>
  {#each exercises as c (c.exercise_id)}
    <a
      href={hrefOf(c.exercise_id)}
      aria-current={c.on ? 'page' : undefined}
      class="inline-flex min-h-11 items-center rounded-full border px-3.5 text-sm font-medium whitespace-nowrap no-underline desktop:min-h-9 {c.on
        ? 'border-text bg-text text-bg'
        : 'border-line bg-panel text-text'}"
      data-chip={c.exercise_id}>{c.name}</a
    >
  {/each}
</div>
