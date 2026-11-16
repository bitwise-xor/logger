<script lang="ts">
  import { getEditPage } from '#lib/homeedit.svelte.js';
  import { nWord } from '#lib/home.js';
  import { HISTORY_STAYS, keyOf, zoneTitle, zoneToggle, type EditZone } from '#lib/homeparts.js';
  import EditChoreRow from './EditChoreRow.svelte';
  import ZoneForm from './ZoneForm.svelte';

  // A zone on Edit zones (app.'s _zone_edit), retired ones too ("· retired", greyed): the zone's chores (retired ones too), "Rename or
  // change the zone" (its form), "Retire this zone" or "Bring back" with "History stays.".
  let { z }: { z: EditZone } = $props();
  const page = getEditPage();
  const k = $derived(keyOf.zone(z.zone_id));
  const open = $derived(!!page.open[k]);

  const btn = 'min-h-11 cursor-pointer rounded-lg border border-line bg-panel px-3.5 text-sm font-medium text-text disabled:opacity-60 desktop:min-h-9';
</script>

<section
  class="flex flex-col gap-2.5 rounded-card border bg-panel p-3 transition-colors duration-500 desktop:p-3.5 {page.changed === k ? 'border-blue' : 'border-line'}"
  data-ezone={z.zone_id}
  data-active={z.active ? 'true' : 'false'}
>
  <div class="flex flex-col gap-2.5 {z.active ? '' : 'opacity-60'}">
    <div class="flex items-baseline justify-between gap-2">
      <h2 class="m-0 text-[15px] font-semibold break-words" data-ezone-title>{zoneTitle(z)}</h2>
      <span class="shrink-0 text-[13px] text-muted" data-ezone-count>{nWord(z.count, 'chore')}</span>
    </div>
    {#each z.chores as c (c.chore_id)}
      <EditChoreRow {c} />
    {/each}
  </div>
  <button type="button" class="{btn} self-start" aria-expanded={open} onclick={() => page.toggleZone(z)} data-toggle={k}>Rename or change the zone</button>
  {#if open}<ZoneForm {k} label="Save" save={() => page.saveZone(z)} />{/if}
  <div class="flex flex-wrap items-center gap-2">
    <button type="button" class={btn} disabled={!!page.busy[`active:${k}`]} onclick={() => page.toggleZoneActive(z)} data-active-btn={k}>{zoneToggle(z)}</button>
    <span class="text-[13px] text-muted">{HISTORY_STAYS}</span>
  </div>
</section>
