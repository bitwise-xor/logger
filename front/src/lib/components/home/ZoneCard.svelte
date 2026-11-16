<script lang="ts">
  import { getZonesPage } from '#lib/homezones.svelte.js';
  import { NO_CHORES, TODOIST, todoistHref, zoneSummary, type ZoneCardRead } from '#lib/homeparts.js';
  import ChoreRow from './ChoreRow.svelte';

  // A zone's card (app.'s _zone): folded or open as the door says, the summary "N chores · oldest ...", the zone's own chores and its
  // share of the whole-flat ones with the tick circle as on Now (a tick on Dust here is the same as the zone's Dust tile). No chores:
  // "no recurring chores". The Storage zone without chores of its own links to the sorting jobs in Todoist, which are at app. (the one
  // link of Home that still leaves for it).
  let { z, appUrl }: { z: ZoneCardRead; appUrl: string } = $props();
  const page = getZonesPage();
  const open = $derived(page.isOpen(z.zone_id));
</script>

{#if z.count === 0}
  {#if z.todoist}
    <a
      href={todoistHref(appUrl)}
      class="flex min-h-14 flex-wrap items-center justify-between gap-x-3 gap-y-0.5 rounded-card border border-line bg-panel px-3 py-2.5 text-text no-underline hover:bg-panel2 desktop:px-3.5"
      data-zone={z.zone_id}
      data-todoist
    >
      <b class="font-medium">{z.name}</b><span class="sr-only">{', '}</span><span class="text-[13px] text-blue">{TODOIST}</span>
    </a>
  {:else}
    <div class="flex min-h-14 flex-wrap items-center justify-between gap-x-3 gap-y-0.5 rounded-card border border-line bg-panel px-3 py-2.5 desktop:px-3.5" data-zone={z.zone_id} data-empty-zone>
      <b class="font-medium">{z.name}</b><span class="sr-only">{', '}</span><span class="text-[13px] text-muted">{NO_CHORES}</span>
    </div>
  {/if}
{:else}
  <section class="flex flex-col rounded-card border border-line bg-panel px-3 desktop:px-3.5" data-zone={z.zone_id} data-open={open ? 'true' : 'false'}>
    <button
      type="button"
      class="flex min-h-14 w-full cursor-pointer items-center justify-between gap-2 border-0 bg-transparent p-0 py-2 text-left text-text"
      aria-expanded={open}
      onclick={() => page.toggle(z.zone_id)}
      data-fold={z.zone_id}
    >
      <span class="flex min-w-0 flex-col">
        <b class="font-semibold" data-zone-name>{z.name}</b>
        <span class="text-[13px] text-muted" data-zone-summary>{zoneSummary(z)}</span>
      </span>
      <svg
        aria-hidden="true"
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        class="shrink-0 text-muted transition-transform {open ? 'rotate-180' : ''}"><path d="M6 9l6 6 6-6"></path></svg
      >
    </button>
    {#if open}
      <div class="flex flex-col border-t border-line" data-zone-rows>
        {#each z.chores as row (row.chore_id)}
          <ChoreRow {row} {page} zone />
        {/each}
      </div>
      {#if z.todoist}
        <a href={todoistHref(appUrl)} class="flex min-h-11 items-center self-start text-[13px] text-blue no-underline hover:underline" data-todoist>{TODOIST}</a>
      {/if}
    {/if}
  </section>
{/if}
