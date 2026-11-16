<script lang="ts">
  import { getZonesPage } from '#lib/homezones.svelte.js';
  import { moreJobs, START_NOTE, startKey, startTitle } from '#lib/homeparts.js';

  // "When did you last do these?" (app.'s _start_card; the mockup's first card): the jobs never logged, a whole-flat chore as one row
  // for its zones, each with four chips (This week, This month, Longer ago, Don't know: the door's words). A tap gives the job a
  // starting point (not a session, not under Recently done); the row leaves at once and the next job takes its place. Plain text, no
  // red: an age is not a fault.
  const page = getZonesPage();
  const start = $derived(page.zones?.start);
  const jobs = $derived((start?.jobs ?? []).filter((j) => !page.leaving[startKey(j)]));
  const more = $derived(start ? moreJobs(start.more) : null);
</script>

{#if start && (start.jobs.length || more)}
  <section aria-labelledby="start-h" class="flex flex-col gap-2.5 rounded-card border border-line bg-panel p-3 desktop:p-3.5" data-card="start">
    <h2 id="start-h" class="m-0 flex items-center gap-2 text-[15px] font-semibold">
      <span aria-hidden="true" class="inline-block size-2.5 rounded-full bg-amber"></span>When did you last do these?
    </h2>
    <p class="m-0 text-[13px] text-muted">{START_NOTE}</p>
    {#each jobs as j (startKey(j))}
      <div class="flex flex-col gap-2 border-t border-line pt-2.5" data-start={startKey(j)}>
        <p class="m-0 break-words">
          <b class="font-medium" data-start-title>{startTitle(j)}</b> <span class="text-[13px] text-muted">{j.interval_text}</span>
        </p>
        <div class="grid grid-cols-2 gap-1.5" role="group" aria-label="When did you last do {j.name}?">
          {#each start.answers as a (a.ago)}
            <button
              type="button"
              class="flex min-h-11 cursor-pointer items-center justify-center rounded-full border border-line bg-panel px-2 text-sm font-medium text-text hover:bg-panel2 disabled:cursor-default disabled:opacity-60 desktop:min-h-9"
              disabled={!!page.busy[`start:${startKey(j)}`]}
              onclick={() => page.answer(j, a.ago)}
              data-chip={a.ago}>{a.label}</button
            >
          {/each}
        </div>
      </div>
    {/each}
    {#if more}<p class="m-0 text-[13px] text-muted" data-more>{more}</p>{/if}
  </section>
{/if}
