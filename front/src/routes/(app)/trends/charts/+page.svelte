<script lang="ts">
  import ProblemCard from '#lib/components/ProblemCard.svelte';
  import ChartCardView from '#lib/components/chart/ChartCardView.svelte';
  import ExerciseChips from '#lib/components/gym/ExerciseChips.svelte';
  import ProgressCard from '#lib/components/gym/ProgressCard.svelte';
  import WeekBars from '#lib/components/gym/WeekBars.svelte';
  import HealthCharts from '#lib/components/health/HealthCharts.svelte';
  import BodyCharts from '#lib/components/trends/BodyCharts.svelte';
  import TrendsTabs from '#lib/components/trends/TrendsTabs.svelte';
  import { chipHref, rangeLinks } from '#lib/trendscharts.js';
  import type { PageProps } from './$types';

  let { data }: PageProps = $props();

  // Trends' Charts tab (deploy 103, step 4 of the move to logger.): app.'s Food > Trends, Health and body charts and Gym progress as one
  // page, read only. ONE range switch (7, 30 or 90 days; links that keep the exercise) for Food, Health and Body, the door's header words
  // ("Last 30 complete days ...") and four sections: Food (the four cards, the chart part draws the door's description as it is),
  // Health (the five charts and the sleep times, as on /health), Body (a chart per measure) and Gym (workouts per week and one
  // exercise's progress, always the last 8 weeks). One column on phones and tablets, the cards in two columns from 1100 px. Each read
  // answers for itself: a failing one shows its section's plain message and the others are drawn.
  const label = 'm-0 text-xs font-medium tracking-wide text-muted uppercase';
  const links = $derived(rangeLinks(data.range, data.x ?? undefined));
  const parts = $derived([data.food, data.health, data.body, data.gym]);
  // Everything failed the same way (the door off, the core down): one message, not four.
  const allDown = $derived(parts.every((r) => r.problem) && new Set(parts.map((r) => r.problem)).size === 1);
  const g = $derived(data.gym.read);
</script>

<svelte:head><title>Trends charts · Logger</title></svelte:head>

<TrendsTabs on="charts" />

{#if allDown}
  <ProblemCard kind={data.food.problem ?? 'trouble'} appHref="{data.appUrl}/web/food/trends" />
{:else}
  <div class="flex flex-col gap-2">
    <nav aria-label="Range" class="grid grid-cols-3 gap-1.5 tablet:flex tablet:flex-wrap tablet:gap-2" data-ranges>
      {#each links as l (l.range)}
        <a
          href={l.href}
          aria-current={l.current ? 'page' : undefined}
          class="flex min-h-11 items-center justify-center rounded-full border px-3 text-sm font-medium whitespace-nowrap no-underline tablet:px-4 desktop:min-h-9 {l.current
            ? 'border-blue bg-blue-bg text-blue'
            : 'border-line bg-panel text-text hover:bg-panel2'}"
          data-range={l.range}>{l.label}</a
        >
      {/each}
    </nav>
    {#if data.food.read}<p class="m-0 text-[13px] text-muted" data-head-line>{data.food.read.title}, {data.food.read.small}</p>{/if}
  </div>

  <main class="flex min-w-0 flex-col gap-5 desktop:gap-6">
    <section aria-labelledby="food-h" class="flex min-w-0 flex-col gap-2" data-section="food">
      <h2 id="food-h" class={label}>Food</h2>
      {#if data.food.read}
        <div class="grid items-start gap-3 desktop:grid-cols-2 desktop:gap-4" data-food-charts>
          {#each data.food.read.charts as c (c.id)}<ChartCardView card={c} />{/each}
        </div>
      {:else}
        <ProblemCard kind={data.food.problem ?? 'trouble'} appHref="{data.appUrl}/web/food/trends" />
      {/if}
    </section>

    <section aria-labelledby="health-h" class="flex min-w-0 flex-col gap-2" data-section="health">
      <h2 id="health-h" class={label}>Health</h2>
      {#if data.health.read}
        <HealthCharts health={data.health.read} twoFrom="desktop" />
      {:else}
        <ProblemCard kind={data.health.problem ?? 'trouble'} appHref="{data.appUrl}/web/health" />
      {/if}
    </section>

    <section aria-labelledby="bodys-h" class="flex min-w-0 flex-col gap-2" data-section="body">
      <h2 id="bodys-h" class={label}>Body</h2>
      {#if data.body.read}
        <BodyCharts body={data.body.read} />
      {:else}
        <ProblemCard kind={data.body.problem ?? 'trouble'} appHref="{data.appUrl}/web/health" />
      {/if}
    </section>

    <section aria-labelledby="gym-h" class="flex min-w-0 flex-col gap-2" data-section="gym">
      <h2 id="gym-h" class={label}>Gym</h2>
      {#if g}
        {#if g.exercise}<ExerciseChips exercises={g.exercises} hrefOf={(id) => chipHref(data.range, id)} />{/if}
        <div class="grid items-start gap-3 desktop:grid-cols-2 desktop:gap-4">
          {#if g.exercise}
            <ProgressCard p={g} />
          {:else}
            <section class="flex min-w-0 flex-col gap-2 rounded-card border border-line bg-panel p-3 desktop:p-3.5" data-card="empty">
              <p class="m-0 text-muted" data-empty>Nothing to show yet: tick exercises on the <a href="/gym">Workout</a> part, and your progress shows here.</p>
            </section>
          {/if}
          <WeekBars perWeek={g.per_week} />
        </div>
        <p class="m-0 text-[13px] text-muted" data-gym-note>The last {g.weeks} weeks, whatever the range above says.</p>
      {:else}
        <ProblemCard kind={data.gym.problem ?? 'trouble'} appHref="{data.appUrl}/web/gym/progress" />
      {/if}
    </section>
  </main>
{/if}
