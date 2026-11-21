<script lang="ts">
  import ProblemCard from '#lib/components/ProblemCard.svelte';
  import FoodHeader from '#lib/components/food/FoodHeader.svelte';
  import { noteDays, NOTES_EMPTY } from '#lib/foodnotes.js';
  import type { PageProps } from './$types';

  let { data }: PageProps = $props();

  // The Food space's Notes tab (21.11.2026): every meal note and food note of the last 90 days, by day, newest first. A row leads to
  // that day's Day tab (a meal's note to its meal, a food's note opens its row); an empty list says how to add one.
  const days = $derived(data.notes ? noteDays(data.notes) : []);
</script>

<svelte:head><title>Notes · Food · Logger</title></svelte:head>

<FoodHeader on="notes" />

{#if !data.notes}
  <ProblemCard kind={data.problem ?? 'trouble'} appHref="{data.appUrl}/web/food" />
{:else}
  <main class="flex max-w-[760px] flex-col gap-3 desktop:gap-4">
    <p class="m-0 text-[13px] text-muted">Notes on meals and foods in the last {data.notes.days} days, newest first.</p>
    {#if !days.length}
      <section class="rounded-card border border-dashed border-line p-3 text-muted desktop:p-3.5" data-notes-empty>
        <p class="m-0">{NOTES_EMPTY}</p>
        <a href="/food" class="mt-1 inline-flex min-h-11 items-center font-medium no-underline desktop:min-h-8">Open today’s Day tab</a>
      </section>
    {/if}
    {#each days as d (d.day)}
      <section aria-labelledby="notes-{d.day}" class="flex flex-col overflow-hidden rounded-card border border-line bg-panel" data-notes-day={d.day}>
        <h2 id="notes-{d.day}" class="m-0 flex items-baseline justify-between gap-2 px-3 pt-3 pb-1 text-[15px] font-semibold desktop:px-3.5">
          <span>{d.title.slice(0, 4)}<span class="num">{d.title.slice(4)}</span>{d.today ? ' · today' : ''}</span>
          <a href={d.href} class="-my-3 inline-flex min-h-11 items-center text-[13px] font-medium no-underline desktop:min-h-8">Day ›</a>
        </h2>
        {#each d.rows as r (r.key)}
          <a href={r.href} class="flex min-h-11 flex-col gap-0.5 border-t border-line px-3 py-2 text-text no-underline hover:bg-panel2 desktop:px-3.5" data-note-row={r.kind}>
            <span class="flex flex-wrap items-baseline gap-x-2 text-[13px] text-muted">
              <span class="font-medium {r.kind === 'food' ? 'text-text' : 'tracking-[0.06em] uppercase'}">{r.what}</span>
              {#if r.sub}<span>{r.sub}</span>{/if}
            </span>
            <span class="break-words" data-note-text>{r.note}</span>
          </a>
        {/each}
      </section>
    {/each}
  </main>
{/if}
