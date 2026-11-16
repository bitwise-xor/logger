<script lang="ts">
  import { rowActions, rowLine, type Habits, type ListHabit } from '#lib/habits.js';
  import { getHabitsPage } from '#lib/habitspage.svelte.js';
  import HabitEdit from '#lib/components/habits/HabitEdit.svelte';

  // A habit of "Your habits": its label, times a day, "avoid", the stats line, and the actions the read allows: Track or Untrack,
  // Edit (opens its form), Retire or Bring back, Delete (asks once, then sends confirmed). A refusal is said right here.
  let { h, groups }: { h: ListHabit; groups: Habits['groups'] } = $props();
  const page = getHabitsPage();
  const act = $derived(rowActions(h));
  const editing = $derived(page.panel?.kind === 'edit' && page.panel.name === h.name);
  const deleting = $derived(page.panel?.kind === 'delete' && page.panel.name === h.name);
  const err = $derived(page.err?.where === `row:${h.name}` ? page.err.text : null);
  const changed = $derived(page.changed.has(h.name));

  const btn = 'min-h-11 cursor-pointer rounded-lg border border-line bg-panel px-3.5 text-text disabled:opacity-60 desktop:min-h-9 desktop:px-3';
</script>

<div class="flex flex-col gap-1.5 border-t py-2.5 {changed ? 'border-blue' : 'border-line'}" data-habit-row={h.name} data-state={h.state} data-changed={changed ? '' : undefined}>
  <div class="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
    <b class="font-medium break-words" data-row-label>{h.label}</b>
    {#if h.state === 'retired'}<span class="rounded-full bg-amber-bg px-2 text-xs text-amber">Retired</span>{/if}
    {#if h.state === 'untracked'}<span class="rounded-full bg-chip px-2 text-xs text-chip-text">Not tracked</span>{/if}
    {#if h.avoid}<span class="rounded-full bg-amber-bg px-2 text-xs text-amber" data-avoid>avoid</span>{/if}
  </div>
  <div class="text-xs text-muted" data-row-line>{rowLine(h, groups)}</div>
  <div class="text-xs text-muted" data-row-stats>{h.stats}</div>
  <div class="flex flex-wrap gap-2 pt-0.5">
    {#if act.track}
      <button type="button" class={btn} disabled={page.busy[`track:${h.name}`]} onclick={() => page.track(h, act.track === 'track')} data-act={act.track}>{act.track === 'track' ? 'Track' : 'Untrack'}</button>
    {/if}
    <button type="button" class={btn} aria-expanded={editing} onclick={() => (editing ? page.closePanel() : page.startEdit(h))} data-act="edit">Edit</button>
    {#if act.retire}
      <button type="button" class={btn} disabled={page.busy[`retire:${h.name}`]} onclick={() => page.retire(h)} data-act="retire">Retire</button>
    {/if}
    {#if act.restore}
      <button type="button" class={btn} disabled={page.busy[`retire:${h.name}`]} onclick={() => page.restore(h)} data-act="restore">Bring back</button>
    {/if}
    {#if act.delete}
      <button type="button" class="{btn} text-amber" aria-expanded={deleting} onclick={() => (deleting ? page.closePanel() : page.askDelete(h))} data-act="delete">Delete</button>
    {/if}
  </div>
  {#if err}<p class="m-0 text-[13px] text-amber" role="alert" data-refusal>{err}</p>{/if}
  {#if deleting}
    <div class="flex flex-col gap-2 rounded-lg border border-line bg-panel2 p-3" data-delete-ask={h.name}>
      <span>Delete {h.label}? It was never ticked, so nothing is lost. This cannot be undone.</span>
      <div class="flex gap-2">
        <button type="button" class="min-h-11 cursor-pointer rounded-lg border-0 bg-amber px-4 font-medium text-on-amber disabled:opacity-60 desktop:min-h-9" disabled={page.busy[`delete:${h.name}`]} onclick={() => page.remove(h)} data-yes-delete>Yes, delete</button>
        <button type="button" class={btn} onclick={() => page.closePanel()}>Keep it</button>
      </div>
    </div>
  {/if}
  {#if editing && page.draft}<HabitEdit {h} />{/if}
</div>
