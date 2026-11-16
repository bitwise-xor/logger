<script lang="ts">
  import { goodLine, splitNote, workoutsText, type Workout } from '#lib/gym.js';

  // "This week's split" (each day, its exercises, done this week or today's) and "Last 4 weeks" (a square per day, Monday first,
  // the workouts of each week): under the list on phones and tablets, the right column from 1100 px.
  let { workout: w }: { workout: Workout } = $props();
  const card = 'flex flex-col rounded-card border border-line bg-panel px-3 py-3 desktop:px-3.5';
  const HEAD = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
</script>

{#if w.week_split.length}
  <section aria-labelledby="split-h" class={card} data-card="split">
    <div class="flex items-center justify-between gap-2 pb-1">
      <h2 id="split-h" class="m-0 text-[15px] font-semibold">This week’s split</h2>
      <a href="/gym/plan" data-split-edit class="inline-flex min-h-11 items-center text-[13px] font-medium desktop:min-h-0">Edit</a>
    </div>
    {#each w.week_split as x (x.day_id)}
      {@const note = splitNote(x)}
      <div class="flex items-center gap-2 border-t border-line py-2" data-split={x.day_id}>
        <span class="flex min-w-0 flex-1 flex-col gap-0.5">
          <span class="font-medium">{x.label}</span>
          <span class="text-[13px] text-muted">{x.exercises}</span>
        </span>
        {#if note}
          <span class="shrink-0 rounded-full px-2 text-xs {x.done ? 'bg-chip text-chip-text' : 'bg-blue-bg text-blue'}" data-split-note>{note}</span>
        {/if}
      </div>
    {/each}
  </section>
{/if}

<section aria-labelledby="weeks-h" class="{card} gap-1.5" data-card="weeks">
  <div class="flex flex-wrap items-baseline justify-between gap-x-2">
    <h2 id="weeks-h" class="m-0 text-[15px] font-semibold">Last 4 weeks</h2>
    <span class="text-[13px] text-muted" data-good>{goodLine(w.weeks)}</span>
  </div>
  <div class="grid grid-cols-[76px_repeat(7,minmax(0,1fr))_24px] items-center gap-1 text-center text-[11px] text-muted" aria-hidden="true">
    <span></span>{#each HEAD as h, i (i)}<span>{h}</span>{/each}<span></span>
  </div>
  {#each w.weeks.weeks as wk (wk.start)}
    <div
      class="grid grid-cols-[76px_repeat(7,minmax(0,1fr))_24px] items-center gap-1"
      role="img"
      aria-label="{wk.label}: {workoutsText(wk.n)}"
      data-week={wk.start}
    >
      <span class="truncate text-[13px] text-muted">{wk.label}</span>
      {#each wk.days as d (d.day)}
        <span
          class="h-5 rounded-[4px] {d.on ? 'bg-text' : d.later ? 'border border-dashed border-line' : 'bg-track'} {d.today ? 'ring-2 ring-blue ring-offset-1 ring-offset-panel' : ''}"
          data-sq={d.on ? 'on' : d.later ? 'later' : 'off'}
        ></span>
      {/each}
      <span class="num text-right text-[13px] text-muted" data-week-n>{wk.n}</span>
    </div>
  {/each}
</section>
