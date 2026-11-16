<script lang="ts">
  import ProblemCard from '#lib/components/ProblemCard.svelte';
  import Chart from '#lib/components/chart/Chart.svelte';
  import GymHeader from '#lib/components/gym/GymHeader.svelte';
  import { activityHref, activityTitle, matchLine, watchTimes } from '#lib/gymread.js';
  import type { PageProps } from './$types';

  let { data }: PageProps = $props();

  // The Gym's Activity part (deploy 97): app.'s Activity tab, read only. While the watch has sent nothing the set-up guide's words
  // (from the read); else one day with the links to the day before and after, the tiles, the night before, the watch's workouts
  // ("Matches Day 2 · Pull in the Logger") and three 7-day charts (the chart part). One column on phones and tablets; from 1100 px
  // the tiles, the night and the workouts on the left, the charts on the right.
  const a = $derived(data.activity);
  const title = $derived(a ? activityTitle(a) : null);
  const card = 'flex min-w-0 flex-col gap-1.5 rounded-card border border-line bg-panel p-3 desktop:p-3.5';
  const arrow = 'inline-flex size-11 shrink-0 items-center justify-center rounded-lg border border-line bg-panel text-xl text-text no-underline desktop:size-9';
</script>

<svelte:head><title>Gym activity · Logger</title></svelte:head>

<GymHeader on="activity" />

{#if !a}
  <ProblemCard kind={data.problem ?? 'trouble'} appHref="{data.appUrl}/web/gym/activity" />
{:else if !a.has_data && a.setup}
  <main>
    <section aria-labelledby="setup-h" class="{card} gap-2" data-card="setup">
      <h2 id="setup-h" class="m-0 text-lg font-semibold tracking-tight" data-setup-title>{a.setup.title}</h2>
      <p class="m-0" data-setup-intro>{a.setup.intro}</p>
      <ol class="m-0 flex list-decimal flex-col gap-1.5 pl-5" data-setup-steps>
        {#each a.setup.steps as step, i (i)}
          <li class="break-words">
            {#each step as part, j (j)}{#if part.code}<code class="rounded bg-chip px-1 py-0.5 text-[13px] break-all text-chip-text">{part.text}</code>{:else}{part.text}{/if}{/each}
          </li>
        {/each}
      </ol>
      <p class="m-0 text-[13px] text-muted" data-setup-note>{a.setup.note}</p>
    </section>
  </main>
{:else}
  <main class="flex flex-col gap-3 desktop:gap-4">
    <div class="flex items-center gap-2" data-day-nav>
      {#if a.prev_day}<a href={activityHref(a.prev_day, a.today)} class={arrow} aria-label="Day before" data-prev>‹</a>{/if}
      <h2 class="m-0 min-w-0 flex-1 text-center text-lg font-semibold tracking-tight" data-day-title>
        {title?.label} <span class="text-[13px] font-normal text-muted">{title?.date}</span>
      </h2>
      {#if a.next_day}
        <a href={activityHref(a.next_day, a.today)} class={arrow} aria-label="Day after" data-next>›</a>
      {:else}
        <span class="{arrow} opacity-35" aria-hidden="true" data-next-off>›</span>
      {/if}
    </div>
    <div class="grid items-start gap-3 desktop:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] desktop:gap-4">
      <div class="flex min-w-0 flex-col gap-3 desktop:gap-4">
        <div class="grid grid-cols-2 gap-2 tablet:grid-cols-4" data-tiles>
          {#each a.tiles as t (t.key)}
            <div class="flex min-w-0 flex-col gap-0.5 rounded-card border border-line bg-panel px-3 py-2.5" data-tile={t.key}>
              <span class="text-[13px] text-muted">{t.label}</span>
              <span class="num text-lg font-semibold break-words" data-tile-text>{t.text}</span>
              <span class="min-h-4 text-xs text-muted" data-tile-sub>{t.sub ?? ''}</span>
            </div>
          {/each}
        </div>

        <section aria-labelledby="sleep-h" class={card} data-card="sleep">
          <div class="flex flex-wrap items-baseline justify-between gap-x-2">
            <h2 id="sleep-h" class="m-0 text-[15px] font-semibold">Sleep, night before</h2>
            {#if a.sleep}<span class="num text-[13px] text-muted" data-in-bed>{a.sleep.in_bed}</span>{/if}
          </div>
          {#if a.sleep}
            <p class="m-0 flex flex-wrap items-baseline gap-x-2"><span class="num text-[26px] leading-tight font-semibold" data-sleep>{a.sleep.text}</span> <span class="text-[13px] text-muted">asleep</span></p>
            <p class="m-0 text-[13px] text-muted" data-stages>{a.sleep.stages_text}</p>
            <p class="m-0 text-[13px] text-muted" data-typed>{a.sleep.typed_text}</p>
          {:else}
            <p class="m-0 text-muted" data-no-sleep>No sleep from the watch for this night.</p>
          {/if}
        </section>

        <section aria-labelledby="watch-h" class={card} data-card="watch">
          <h2 id="watch-h" class="m-0 text-[15px] font-semibold">Workouts the watch recorded</h2>
          {#each a.workouts as w, i (i)}
            <div class="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 border-t border-line py-1.5" data-watch>
              <span class="flex min-w-0 flex-1 basis-40 flex-col gap-0.5">
                <span class="font-medium break-words">{w.name}</span>
                <span class="text-[13px] text-muted">{w.meta}</span>
                {#if matchLine(w)}<span class="text-[13px] text-blue" data-match>{matchLine(w)}</span>{/if}
              </span>
              <span class="num text-[13px] text-muted">{watchTimes(w)}</span>
            </div>
          {:else}
            <p class="m-0 text-muted" data-no-watch>None on this day.</p>
          {/each}
        </section>
      </div>

      <div class="flex min-w-0 flex-col gap-3 desktop:gap-4" data-charts>
        {#each a.charts as c (c.id)}
          <section class={card} data-chart-card={c.id}>
            <h2 class="m-0 text-[15px] font-semibold">{c.title}</h2>
            <Chart chart={c.chart} id={c.id} />
          </section>
        {/each}
      </div>
    </div>
  </main>
{/if}
