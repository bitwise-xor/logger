<script lang="ts">
  import ProblemCard from '#lib/components/ProblemCard.svelte';
  import GymHeader from '#lib/components/gym/GymHeader.svelte';
  import { cardDate, cardSub, exerciseLine } from '#lib/gymread.js';
  import type { PageProps } from './$types';

  let { data }: PageProps = $props();

  // The Gym's History part (deploy 97): app.'s History tab, read only. The last 60 workouts, newest first, each a card with its date,
  // its day of the split (or "Free workout") and times, and its exercises with their sets. A card keeps its anchor (#w<id>), so a
  // link can jump to it; the card jumped to is marked. One column on phones and tablets, two from 1100 px.
  const list = $derived(data.workouts);
</script>

<svelte:head><title>Gym history · Logger</title></svelte:head>

<GymHeader on="history" />

{#if !list}
  <ProblemCard kind={data.problem ?? 'trouble'} appHref="{data.appUrl}/web/gym/history" />
{:else if list.length === 0}
  <section class="rounded-card border border-line bg-panel p-3 desktop:p-3.5"><p class="m-0 text-muted" data-empty>No workouts yet.</p></section>
{:else}
  <main class="grid items-start gap-3 desktop:grid-cols-2 desktop:gap-4" data-history>
    {#each list as w (w.workout_id)}
      <article
        id={w.anchor}
        aria-labelledby="{w.anchor}-h"
        class="flex min-w-0 scroll-mt-3 flex-col gap-1 rounded-card border border-line bg-panel px-3 py-3 target:border-blue desktop:px-3.5"
        data-workout={w.workout_id}
      >
        <div class="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
          <h2 id="{w.anchor}-h" class="m-0 text-[15px] font-semibold" data-date>{cardDate(w)}</h2>
          <span class="num text-[13px] text-muted" data-sub>{cardSub(w)}</span>
        </div>
        {#each w.exercises as x (x.exercise_id)}
          {@const l = exerciseLine(x)}
          <div class="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 border-t border-line py-1.5" data-line>
            <span class="font-medium break-words" data-line-name>{l.name}</span>
            <span class="num min-w-0 text-[13px] break-words text-muted" data-line-text>{l.text}</span>
          </div>
        {:else}
          <p class="m-0 border-t border-line py-1.5 text-muted">Nothing logged.</p>
        {/each}
      </article>
    {/each}
  </main>
{/if}
