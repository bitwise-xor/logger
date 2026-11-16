<script lang="ts">
  import ProblemCard from '#lib/components/ProblemCard.svelte';
  import ExerciseChips from '#lib/components/gym/ExerciseChips.svelte';
  import GymHeader from '#lib/components/gym/GymHeader.svelte';
  import ProgressCard from '#lib/components/gym/ProgressCard.svelte';
  import WeekBars from '#lib/components/gym/WeekBars.svelte';
  import { progressHref, sessionDay } from '#lib/gymread.js';
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
      <ExerciseChips exercises={p.exercises} hrefOf={progressHref} />
      <div class="grid items-start gap-3 desktop:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] desktop:gap-4">
        <ProgressCard {p} />
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
