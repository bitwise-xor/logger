<script lang="ts">
  import Chart from '#lib/components/chart/Chart.svelte';
  import type { ChartCard } from '#lib/health.js';

  // One chart card of the door (Health's five, Trends' four food cards): the title with the grey words after it, the stat line in
  // its parts (the bold ones), the chart and its colour keys. Shared by /health and /trends/charts.
  let { card: c }: { card: ChartCard } = $props();
</script>

<div class="flex min-w-0 flex-col rounded-card border border-line bg-panel px-3 pt-3 pb-3 desktop:px-3.5" data-chart-card={c.id}>
  <h2 class="m-0 text-[15px] font-semibold">{c.title}{#if c.small}{' '}<span class="text-[13px] font-normal text-muted">{c.small}</span>{/if}</h2>
  <p class="m-0 mt-0.5 mb-1.5 text-[13px] text-muted tabular-nums" data-stat>
    {#each c.stat as p, i (i)}{#if p.bold}<b class="font-semibold text-text">{p.text}</b>{:else}{p.text}{/if}{/each}
  </p>
  <Chart chart={c.chart} id={c.id} legend={c.legend} />
</div>
