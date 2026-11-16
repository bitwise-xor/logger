<script lang="ts">
  import ProblemCard from '#lib/components/ProblemCard.svelte';
  import GymDock from '#lib/components/gym/GymDock.svelte';
  import GymHeader from '#lib/components/gym/GymHeader.svelte';
  import PlanDay from '#lib/components/gym/PlanDay.svelte';
  import { DAY_NAME_MAX, doneChip } from '#lib/gymplan.js';
  import { PlanPage, setPlanPage } from '#lib/planpage.svelte.js';
  import { untrack } from 'svelte';
  import type { PageProps } from './$types';

  let { data }: PageProps = $props();

  // The Gym's Plan part (deploy 97): app.'s Plan tab in the new look, every change saving in place. "How the day is picked" with this
  // week's done days, a card per active workout day (its exercises: numbers, up and down, take off with Undo; "+ Add exercise";
  // "Rename or remove"), "+ New workout day" and "Removed days". One column on phones and tablets, the day cards in two from 1100 px.
  const page = setPlanPage(untrack(() => new PlanPage(data.plan, data.undo)));
  $effect.pre(() => page.load(data.plan, data.undo));

  const p = $derived(page.plan);

  const field = 'h-11 w-full min-w-0 rounded-lg border border-line bg-panel px-3 text-base text-text desktop:h-9 desktop:text-sm';
  const btn = 'min-h-11 cursor-pointer rounded-lg px-4 font-medium disabled:opacity-60 desktop:min-h-9';
</script>

<svelte:head><title>Gym plan · Logger</title></svelte:head>

<GymHeader on="plan" />

{#if !p}
  <ProblemCard kind={data.problem ?? 'trouble'} appHref="{data.appUrl}/web/gym/plan" />
{:else}
  <main class="grid items-start gap-3 desktop:grid-cols-2 desktop:gap-4">
    <section aria-labelledby="how-h" class="flex min-w-0 flex-col gap-1.5 rounded-card border border-line bg-panel p-3 desktop:col-span-2 desktop:p-3.5" data-card="how">
      <h2 id="how-h" class="m-0 text-lg font-semibold tracking-tight">How the day is picked</h2>
      <p class="m-0" data-how>{p.how}</p>
      {#if p.week}<p class="m-0 text-[13px] text-muted" data-week>{p.week}</p>{/if}
      {#if p.done.length}
        <ul class="m-0 flex list-none flex-wrap gap-1.5 p-0" aria-label="Done this week" data-done>
          {#each p.done as d (d.day_id)}
            <li class="rounded-full bg-chip px-2.5 py-0.5 text-xs text-chip-text" data-done-day={d.day_id}>{doneChip(d)}</li>
          {/each}
        </ul>
      {/if}
    </section>

    {#each p.days as day (day.day_id)}
      <PlanDay {day} />
    {/each}

    <section aria-labelledby="newday-h" class="flex min-w-0 flex-col gap-2.5 rounded-card border border-line bg-panel p-3 desktop:p-3.5" data-card="newday">
      <h2 id="newday-h" class="sr-only">New workout day</h2>
      {#if !page.newOpen}
        <button type="button" class="{btn} self-start border border-line bg-panel text-text" onclick={() => (page.newOpen = true)} data-newday>+ New workout day</button>
      {:else}
        <form method="POST" action="?/gym_daynew" class="m-0 flex flex-col gap-2.5" onsubmit={(e) => (e.preventDefault(), page.addDay())} data-newday-form>
          <label class="flex flex-col gap-1 text-[13px] text-muted">
            Name of the new workout day
            <input name="name" maxlength={DAY_NAME_MAX} autocomplete="off" placeholder="e.g. Push" bind:value={page.newName} class={field} data-newday-name />
          </label>
          {#if page.errs.new}<p role="alert" class="m-0 text-[13px] text-amber" data-err>{page.errs.new}</p>{/if}
          <div class="flex flex-wrap items-center gap-2">
            <button type="submit" class="{btn} border-0 bg-text text-bg" disabled={!!page.busy.new} data-newday-go>Add day</button>
            {#if p.days.length}<button type="button" class="{btn} border border-line bg-panel text-text" onclick={() => (page.newOpen = false)}>Cancel</button>{/if}
          </div>
        </form>
      {/if}
    </section>

    {#if p.removed.length}
      <section aria-labelledby="removed-h" class="flex min-w-0 flex-col rounded-card border border-line bg-panel px-3 py-3 desktop:px-3.5" data-card="removed">
        <h2 id="removed-h" class="m-0 pb-1 text-[15px] font-semibold">Removed days</h2>
        {#each p.removed as x (x.day_id)}
          <div class="flex items-center gap-2 border-t border-line py-1.5" data-removed={x.day_id}>
            <span class="min-w-0 flex-1 font-medium break-words">{x.name}</span>
            <button type="button" class="{btn} border border-line bg-panel text-text" disabled={!!page.busy[`day:${x.day_id}`]} onclick={() => page.bringBack(x)} data-bring={x.day_id}>Bring back</button>
          </div>
        {/each}
      </section>
    {/if}
  </main>
{/if}

<GymDock answers={page} />
