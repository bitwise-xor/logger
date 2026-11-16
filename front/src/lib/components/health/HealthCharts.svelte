<script lang="ts">
  import Chart from '#lib/components/chart/Chart.svelte';
  import ClockRows from '#lib/components/chart/ClockRows.svelte';
  import Legend from '#lib/components/chart/Legend.svelte';
  import type { Health } from '#lib/health.js';

  // The six charts of the range (app.'s Health page): weight, blood pressure, fasted sugar, sleep hours, mood and energy (the
  // door's chart descriptions, drawn by the chart part), and the sleep times (a row per date across the clock). One column on
  // phones, two from the tablet width up.
  let { health }: { health: Health } = $props();
  const t = $derived(health.times);
  const card = 'flex min-w-0 flex-col rounded-card border border-line bg-panel px-3 pt-3 pb-3 desktop:px-3.5';
</script>

<section aria-label="Charts" class="grid items-start gap-3 tablet:grid-cols-2 desktop:gap-4" data-charts>
  {#each health.charts as c (c.id)}
    <div class={card} data-chart-card={c.id}>
      <h2 class="m-0 text-[15px] font-semibold">{c.title}{#if c.small}{' '}<span class="text-[13px] font-normal text-muted">{c.small}</span>{/if}</h2>
      <p class="m-0 mt-0.5 mb-1.5 text-[13px] text-muted tabular-nums" data-stat>
        {#each c.stat as p, i (i)}{#if p.bold}<b class="font-semibold text-text">{p.text}</b>{:else}{p.text}{/if}{/each}
      </p>
      <Chart chart={c.chart} id={c.id} legend={c.legend} />
    </div>
  {/each}
  <div class={card} data-chart-card="times">
    <h2 class="m-0 text-[15px] font-semibold">{t.title}{#if t.small}{' '}<span class="text-[13px] font-normal text-muted">{t.small}</span>{/if}</h2>
    {#if t.empty}<p class="m-0 py-3 text-muted">No bed and wake-up times in this range yet.</p>{/if}
    <ClockRows rows={t} label="Sleep times of the last {t.days} days" id="times" />
    <Legend items={t.legend} />
  </div>
</section>
