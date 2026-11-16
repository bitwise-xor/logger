<script lang="ts">
  import ProblemCard from '#lib/components/ProblemCard.svelte';
  import ThemeButton from '#lib/components/ThemeButton.svelte';
  import GymAdd from '#lib/components/gym/GymAdd.svelte';
  import GymParts from '#lib/components/gym/GymParts.svelte';
  import GymRow from '#lib/components/gym/GymRow.svelte';
  import GymSide from '#lib/components/gym/GymSide.svelte';
  import AnswerBar from '#lib/components/today/AnswerBar.svelte';
  import { hintText, otherLabel } from '#lib/gym.js';
  import { GymPage, setGymPage } from '#lib/gympage.svelte.js';
  import { untrack } from 'svelte';
  import type { PageProps } from './$types';

  let { data }: PageProps = $props();

  // The Gym's Workout page (deploy 96, step 2 of the move to logger.): app.'s Workout tab in the new look, every tap saving in place.
  // Today's day of the split and the chips to pick another, a row per exercise (one tap logs it), "Other exercises", "+ Add
  // exercise", "This week's split" and the last 4 weeks. One column on phones and tablets; from 1100 px the exercises left and the
  // split and the weeks in a right column of 340 px. No gym save is sent again by the page (saver.ts), so no resend on mount.
  const page = setGymPage(untrack(() => new GymPage(data.workout, data.undo)));
  $effect.pre(() => page.load(data.workout, data.undo));

  const w = $derived(page.workout);
  const hint = $derived(w ? hintText(w) : null);

  // The answer bar floats above the tab bar on phones; the page leaves room for it (the layout's --dock).
  let barHeight = $state(0);
  $effect(() => {
    document.documentElement.style.setProperty('--dock', `${barHeight}px`);
    return () => document.documentElement.style.removeProperty('--dock');
  });
</script>

<svelte:head><title>Gym · Logger</title></svelte:head>

<header class="flex flex-col gap-1.5">
  <div class="flex items-center gap-2">
    <h1 class="m-0 flex-1 text-[26px] leading-[1.1] font-semibold tracking-tight desktop:text-[30px]">Gym</h1>
    <ThemeButton />
  </div>
  <GymParts appUrl={data.appUrl} />
</header>

{#if !w}
  <ProblemCard kind={data.problem ?? 'trouble'} appHref="{data.appUrl}/web/gym" />
{:else}
  <main class="flex flex-col gap-3 desktop:flex-row desktop:items-start desktop:gap-4">
    <section aria-labelledby="wk-h" class="flex min-w-0 flex-col gap-2.5 rounded-card border border-line bg-panel p-3 desktop:flex-1 desktop:p-3.5" data-card="workout">
      <div class="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
        <h2 id="wk-h" class="m-0 text-lg font-semibold tracking-tight desktop:text-xl" data-title>{w.title}</h2>
        <span class="num text-[13px] text-muted" data-status>{w.status}</span>
      </div>
      {#if w.chips.length}
        <div role="group" aria-label="Today’s day" class="flex flex-wrap gap-1.5" data-chips>
          {#each w.chips as c (c.day_id ?? 'free')}
            <button
              type="button"
              class="inline-flex min-h-11 cursor-pointer items-center rounded-full border px-3.5 text-sm font-medium whitespace-nowrap disabled:opacity-60 desktop:min-h-9 {c.on
                ? 'border-text bg-text text-bg'
                : 'border-line bg-panel text-text'}"
              aria-pressed={c.on}
              disabled={!!page.busy.pick}
              onclick={() => page.pick(c)}
              data-chip={c.day_id ?? 'free'}>{c.label}</button
            >
          {/each}
        </div>
        {#if w.why}<p class="m-0 text-[13px] text-muted" data-why>{w.why}</p>{/if}
      {:else}
        <p class="m-0 text-[13px] text-muted">No split yet: make one on the <a href="{data.appUrl}/web/gym/plan">Plan</a> tab (in the full app).</p>
      {/if}

      <div class="flex flex-col gap-2" data-list="exercises">
        {#each w.exercises as row (row.exercise_id)}
          <GymRow {row} />
        {:else}
          <p class="m-0 text-muted" data-empty>{w.empty}</p>
        {/each}
      </div>

      {#if w.other.length}
        <button
          type="button"
          class="min-h-11 cursor-pointer self-start rounded-lg border border-line bg-panel px-4 font-medium text-text desktop:min-h-9"
          aria-expanded={page.otherOpen}
          onclick={() => (page.otherOpen = !page.otherOpen)}
          data-other>{otherLabel(w)} <span aria-hidden="true" class="inline-block text-muted transition-transform {page.otherOpen ? 'rotate-90' : ''}">›</span></button
        >
        {#if page.otherOpen}
          <div class="flex flex-col gap-2" data-list="other">
            {#each w.other as row (row.exercise_id)}
              <GymRow {row} />
            {/each}
          </div>
        {/if}
      {/if}

      <GymAdd />
      {#if hint}<p class="m-0 text-xs text-muted" data-hint>{hint}</p>{/if}
    </section>
    <div class="flex min-w-0 flex-col gap-3 desktop:w-[340px] desktop:shrink-0 desktop:gap-4" data-side>
      <GymSide workout={w} appUrl={data.appUrl} />
    </div>
  </main>
{/if}

<!-- The answer bar: above the tab bar on phones, at the bottom right on the PC (as on the Habits page). -->
<div
  bind:clientHeight={barHeight}
  class="pointer-events-none fixed inset-x-0 bottom-[calc(52px+env(safe-area-inset-bottom))] z-20 px-3.5 pb-2 desktop:static desktop:p-0"
>
  <AnswerBar answers={page} />
</div>
