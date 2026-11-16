<script lang="ts">
  import ProblemCard from '#lib/components/ProblemCard.svelte';
  import Chart from '#lib/components/chart/Chart.svelte';
  import GymHeader from '#lib/components/gym/GymHeader.svelte';
  import WeekBars from '#lib/components/gym/WeekBars.svelte';
  import { progressHref, progressTitle, sessionDay, subParts } from '#lib/gymread.js';
  import type { PageProps } from './$types';

  let { data }: PageProps = $props();

  // The Gym's Progress part (deploy 97): app.'s Progress tab, read only. The exercise chips (the read's order: the most recently done
  // first), the top number with its change, the line under it (top set and the estimated 1-rep max), the chart of the 8 weeks (the
  // chart part), "Workouts per week" as bars and the last 6 sessions. One column on phones and tablets; from 1100 px the chart card
  // on the left, the bars and the sessions on the right.
  const p = $derived(data.progress);
  const card = 'flex min-w-0 flex-col gap-2 rounded-card border border-line bg-panel p-3 desktop:p-3.5';
</script>

<svelte:head><title>Gym progress · Logger</title></svelte:head>

<GymHeader on="progress" />

{#if !p}
  <ProblemCard kind={data.problem ?? 'trouble'} appHref="{data.appUrl}/web/gym/progress" />
{:else}
  <main class="flex flex-col gap-3 desktop:gap-4">
    {#if p.exercise}
      <div role="group" aria-label="Exercise" class="flex flex-wrap gap-1.5" data-chips>
        {#each p.exercises as c (c.exercise_id)}
          <a
            href={progressHref(c.exercise_id)}
            aria-current={c.on ? 'page' : undefined}
            class="inline-flex min-h-11 items-center rounded-full border px-3.5 text-sm font-medium whitespace-nowrap no-underline desktop:min-h-9 {c.on
              ? 'border-text bg-text text-bg'
              : 'border-line bg-panel text-text'}"
            data-chip={c.exercise_id}>{c.name}</a
          >
        {/each}
      </div>
      <div class="grid items-start gap-3 desktop:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] desktop:gap-4">
        <section aria-labelledby="pr-h" class={card} data-card="progress">
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
        <div class="flex min-w-0 flex-col gap-3 desktop:gap-4">
          <WeekBars perWeek={p.per_week} />
          <section aria-labelledby="recent-h" class={card} data-card="recent">
            <h2 id="recent-h" class="m-0 text-[15px] font-semibold">Recent sessions</h2>
            <table class="w-full border-collapse" data-recent>
              <tbody>
                {#each p.recent ?? [] as r (r.day)}
                  <tr class="border-t border-line align-top">
                    <td class="py-2 pr-3 whitespace-nowrap text-muted">{sessionDay(r.day)}</td>
                    <td class="num w-full py-2 break-words" data-recent-text>{r.text}</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </section>
        </div>
      </div>
    {:else}
      <section class={card} data-card="empty">
        <p class="m-0 text-muted" data-empty>Nothing to show yet: tick exercises on the <a href="/gym">Workout</a> part, and your progress shows here.</p>
      </section>
      <WeekBars perWeek={p.per_week} />
    {/if}
  </main>
{/if}
