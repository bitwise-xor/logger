<script lang="ts">
  import Chart from '#lib/components/chart/Chart.svelte';
  import { progressTitle, subParts, type Progress } from '#lib/gymread.js';

  // The chosen exercise's card of the Progress read: the title ("Bench press: top weight") with "8 weeks", the top number with its
  // change, the line under it (top set and the estimated 1-rep max) and the chart of the 8 weeks (the chart part). Shared by the Gym's
  // Progress part and Trends' Charts tab.
  let { p }: { p: Progress } = $props();
</script>

<section aria-labelledby="pr-h" class="flex min-w-0 flex-col gap-2 rounded-card border border-line bg-panel p-3 desktop:p-3.5" data-card="progress">
  <div class="flex flex-wrap items-baseline justify-between gap-x-2">
    <h2 id="pr-h" class="m-0 text-lg font-semibold tracking-tight" data-title>{progressTitle(p)}</h2>
    <span class="text-[13px] text-muted">{p.weeks} weeks</span>
  </div>
  <p class="m-0 flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
    <span class="num text-[28px] leading-tight font-semibold" data-top>{p.top_text}</span>
    <span class="text-[13px] text-muted" data-change>{p.change}</span>
  </p>
  <ul class="m-0 flex list-none flex-wrap gap-1.5 p-0" data-sub>
    {#each subParts(p.sub) as s (s.text)}
      <li class="rounded-full px-2.5 py-0.5 text-[13px] {s.orm ? 'bg-blue-bg text-blue' : 'bg-chip text-chip-text'}" data-sub-part={s.orm ? 'orm' : 'top'}>{s.text}</li>
    {/each}
  </ul>
  {#if p.chart}
    <Chart chart={p.chart} id="gym" />
  {:else}
    <p class="m-0 text-[13px] text-muted" data-no-chart>No sessions in the last 8 weeks.</p>
  {/if}
</section>
