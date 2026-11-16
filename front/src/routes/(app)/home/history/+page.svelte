<script lang="ts">
  import ProblemCard from '#lib/components/ProblemCard.svelte';
  import GymDock from '#lib/components/gym/GymDock.svelte';
  import HomeHeader from '#lib/components/home/HomeHeader.svelte';
  import { HistoryPage, setHistoryPage } from '#lib/homehistory.svelte.js';
  import { doneKey, EARLIER_NOTE, lastLine, moreHref, removeLabel, timeOf } from '#lib/homeparts.js';
  import { untrack } from 'svelte';
  import type { PageProps } from './$types';

  let { data }: PageProps = $props();

  // Home's History page (deploy 100): app.'s History tab in the new look. "+ Add one done earlier" (a job, a date; it gets 12:00 on that
  // day), "Ticked lately" with "last N", a heading per day and rows with the time (blank for a dated one), the label, how it came and ×
  // (the row leaves at once; Undo puts it back), "Show more" while the door says there is more. One column, up to 720 px on the PC.
  const page = setHistoryPage(untrack(() => new HistoryPage(data.history, data.undo)));
  $effect.pre(() => page.load(data.history, data.undo));

  const h = $derived(page.history);
  const more = $derived(h ? moreHref(h) : null);
  const field = 'h-11 w-full min-w-0 rounded-lg border border-line bg-panel px-3 text-base text-text desktop:h-9 desktop:text-sm';
  const btn = 'min-h-11 cursor-pointer rounded-lg px-4 font-medium disabled:opacity-60 desktop:min-h-9';
</script>

<svelte:head><title>Home history · Logger</title></svelte:head>

<HomeHeader on="history" />

{#if !h}
  <ProblemCard kind={data.problem ?? 'trouble'} appHref="{data.appUrl}/web/home/history" />
{:else}
  <main class="flex flex-col gap-3 desktop:max-w-[720px] desktop:gap-4">
    {#if h.jobs.length}
      <section class="flex flex-col gap-2.5 rounded-card border border-line bg-panel p-3 desktop:p-3.5" data-card="earlier">
        <button type="button" class="{btn} self-start border border-line bg-panel text-text" aria-expanded={page.open} onclick={() => page.toggle()} data-earlier-open
          >+ Add one done earlier</button
        >
        {#if page.open}
          <form
            method="POST"
            action="?/home_earlier"
            novalidate
            class="m-0 flex flex-col gap-2.5 rounded-lg border border-line bg-panel2 p-3"
            onsubmit={(e) => (e.preventDefault(), page.save())}
            data-earlier-form
          >
            <label class="flex flex-col gap-1 text-[13px] text-muted">
              Job
              <select name="pairs" bind:value={page.job} class={field} data-earlier-job>
                {#each h.jobs as j (j.label)}
                  <option value={j.pairs.map(([c, z]) => `${c}-${z}`).join(',')}>{j.label}</option>
                {/each}
              </select>
            </label>
            <label class="flex flex-col gap-1 text-[13px] text-muted">
              Done on
              <input type="date" name="when" required min={page.range?.min} max={page.range?.max} bind:value={page.date} class={field} data-earlier-date />
            </label>
            {#if page.err}<p role="alert" class="m-0 text-[13px] text-amber" data-err>{page.err}</p>{/if}
            <div class="flex flex-wrap items-center gap-2.5">
              <button type="submit" class="{btn} border-0 bg-text text-bg" disabled={!!page.busy.earlier} data-earlier-save>Save</button>
              <span class="text-[13px] text-muted">{EARLIER_NOTE}</span>
            </div>
          </form>
        {/if}
      </section>
    {/if}

    <section aria-labelledby="hist-h" class="flex flex-col rounded-card border border-line bg-panel px-3 pt-3 pb-2 desktop:px-3.5" data-card="history">
      {#if h.days.length === 0}
        <p class="m-0 pb-1 text-muted" data-empty>Nothing ticked yet.</p>
      {:else}
        <div class="flex items-baseline justify-between gap-2 pb-1">
          <h2 id="hist-h" class="m-0 text-[15px] font-semibold">Ticked lately</h2>
          <span class="text-[13px] text-muted" data-count>{lastLine(h)}</span>
        </div>
        {#each h.days as d (d.day)}
          <h3 class="m-0 pt-3 pb-1 text-[13px] font-medium text-muted" data-day={d.day}>{d.label}</h3>
          <div class="flex flex-col" data-day-rows={d.day}>
            {#each d.rows as e (doneKey(e))}
              {#if !page.gone[doneKey(e)]}
                <div
                  class="flex min-h-11 items-center gap-2 border-t border-l-2 border-line py-0.5 pl-2 transition-colors duration-500 first:border-t-0 {page.fresh[doneKey(e)]
                    ? 'border-l-blue'
                    : 'border-l-transparent'}"
                  data-hist={doneKey(e)}
                >
                  <span class="num w-11 shrink-0 text-[13px] text-muted" data-time>{timeOf(e)}</span>
                  <span class="min-w-0 flex-1 break-words" data-label>{e.label}</span>
                  <span class="shrink-0 text-[13px] text-muted" data-how>{e.how}</span>
                  <button
                    type="button"
                    class="flex size-11 shrink-0 cursor-pointer items-center justify-center border-0 bg-transparent p-0 text-muted hover:text-text disabled:cursor-default disabled:opacity-50"
                    aria-label={removeLabel(e)}
                    title="Remove"
                    disabled={!!page.busy[`remove:${doneKey(e)}`]}
                    onclick={() => page.remove(e)}
                    data-remove={doneKey(e)}
                  >
                    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"
                      ><path d="M6 6l12 12M18 6L6 18"></path></svg
                    >
                  </button>
                </div>
              {/if}
            {/each}
          </div>
        {/each}
        {#if more}
          <a
            href={more}
            class="mt-2 inline-flex min-h-11 items-center self-start rounded-lg border border-line px-3.5 text-sm font-medium text-text no-underline hover:bg-panel2 desktop:min-h-9"
            data-more>Show more</a
          >
        {/if}
      {/if}
    </section>
  </main>
{/if}

<GymDock answers={page} />
