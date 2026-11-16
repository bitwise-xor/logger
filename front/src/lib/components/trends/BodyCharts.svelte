<script lang="ts">
  import Chart from '#lib/components/chart/Chart.svelte';
  import type { Body } from '#lib/health.js';

  // The Body section of Trends' Charts tab: the door's chart of each measure for the range (every chart comes from GET /body, as
  // on the Health page's body card, where one is picked by a chip; here all of them). One column on phones, two on tablets, three
  // from 1100 px. Without a session in the range: a plain line and the door's hint on how to log one.
  let { body }: { body: Body } = $props();
</script>

<section aria-labelledby="body-h" class="flex min-w-0 flex-col gap-2 rounded-card border border-line bg-panel px-3 py-3 desktop:px-3.5" data-card="body-charts">
  <h2 id="body-h" class="m-0 text-[15px] font-semibold">Measurements <span class="text-[13px] font-normal text-muted">in cm</span></h2>
  {#if body.charts.length}
    <div class="grid gap-x-4 gap-y-3 tablet:grid-cols-2 desktop:grid-cols-3">
      {#each body.charts as c (c.key)}
        <div class="flex min-w-0 flex-col" data-body-chart={c.key}>
          <h3 class="m-0 text-sm font-medium">{c.label}</h3>
          <Chart chart={c.chart} id="body-{c.key}" />
        </div>
      {/each}
    </div>
  {:else}
    <p class="m-0 text-muted" data-no-body>No measurements yet. <a href="/health#body">Measure on the Health page</a>.</p>
    <p class="m-0 text-xs text-muted">{body.hint}</p>
  {/if}
</section>
