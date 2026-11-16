<script lang="ts">
  import ChartCardView from '#lib/components/chart/ChartCardView.svelte';
  import ClockRows from '#lib/components/chart/ClockRows.svelte';
  import Legend from '#lib/components/chart/Legend.svelte';
  import type { Health } from '#lib/health.js';

  // The six charts of the range (app.'s Health page): weight, blood pressure, fasted sugar, sleep hours, mood and energy (the
  // door's chart descriptions, drawn by the chart part), and the sleep times (a row per date across the clock). One column on
  // phones, two from the tablet width up (`twoFrom` "desktop": two from 1100 px only, as Trends' Charts tab has it).
  let { health, twoFrom = 'tablet' }: { health: Health; twoFrom?: 'tablet' | 'desktop' } = $props();
  const t = $derived(health.times);
  const card = 'flex min-w-0 flex-col rounded-card border border-line bg-panel px-3 pt-3 pb-3 desktop:px-3.5';
</script>

<section aria-label="Charts" class="grid items-start gap-3 desktop:grid-cols-2 desktop:gap-4 {twoFrom === 'tablet' ? 'tablet:grid-cols-2' : ''}" data-charts>
  {#each health.charts as c (c.id)}
    <ChartCardView card={c} />
  {/each}
  <div class={card} data-chart-card="times">
    <h2 class="m-0 text-[15px] font-semibold">{t.title}{#if t.small}{' '}<span class="text-[13px] font-normal text-muted">{t.small}</span>{/if}</h2>
    {#if t.empty}<p class="m-0 py-3 text-muted">No bed and wake-up times in this range yet.</p>{/if}
    <ClockRows rows={t} label="Sleep times of the last {t.days} days" id="times" />
    <Legend items={t.legend} />
  </div>
</section>
