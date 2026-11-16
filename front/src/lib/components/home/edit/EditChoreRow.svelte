<script lang="ts">
  import { getEditPage } from '#lib/homeedit.svelte.js';
  import { choreToggle, keyOf, type EditChore } from '#lib/homeparts.js';
  import ChoreForm from './ChoreForm.svelte';
  import PerZoneForm from './PerZoneForm.svelte';

  // One chore on Edit zones (app.'s _chore_edit): its name and its line ("weekly · 10 min", " · retired"), tapping it opens its form;
  // "Retire" or "Bring back" (a retired chore is greyed; its history stays); for an active whole-flat chore "Per zone". `id="chore-7"`
  // is where a chore's page leads (Edit, with this form open).
  let { c }: { c: EditChore } = $props();
  const page = getEditPage();
  const k = $derived(keyOf.chore(c.chore_id));
  const pk = $derived(keyOf.perZone(c.chore_id));
  const open = $derived(!!page.open[k]);
  const pz = $derived(!!page.open[pk]);

  const btn = 'min-h-11 cursor-pointer rounded-lg border border-line bg-panel px-3.5 text-sm font-medium text-text disabled:opacity-60 desktop:min-h-9';
</script>

<div id="chore-{c.chore_id}" class="flex scroll-mt-4 flex-col gap-2 border-t border-line pt-2 first:border-t-0 first:pt-0" data-echore={c.chore_id} data-active={c.active ? 'true' : 'false'}>
  <div class="flex items-center gap-2 rounded-lg border-l-2 pl-2 transition-colors duration-500 {page.changed === k ? 'border-l-blue' : 'border-l-transparent'}">
    <button
      type="button"
      class="flex min-h-11 min-w-0 flex-1 cursor-pointer flex-col justify-center border-0 bg-transparent p-0 py-1 text-left text-text {c.active ? '' : 'opacity-60'}"
      aria-expanded={open}
      onclick={() => page.toggleChore(c)}
      data-toggle={k}
    >
      <b class="font-medium break-words" data-echore-name>{c.name}</b>
      <span class="text-[13px] text-muted" data-echore-meta>{c.meta}</span>
    </button>
    <button type="button" class={btn} disabled={!!page.busy[`active:${k}`]} onclick={() => page.toggleChoreActive(c)} data-active-btn={k}>{choreToggle(c)}</button>
  </div>
  {#if open}
    <ChoreForm {k} label="Save" save={() => page.saveChore(c)} />
    {#if c.per_zone && c.active}
      <button type="button" class="{btn} self-start" aria-expanded={pz} onclick={() => page.togglePerZone(c)} data-pz-toggle={c.chore_id}>Per zone</button>
      {#if pz}<PerZoneForm {c} />{/if}
    {/if}
  {/if}
</div>
