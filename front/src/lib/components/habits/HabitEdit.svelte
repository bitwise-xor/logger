<script lang="ts">
  import type { ListHabit } from '#lib/habits.js';
  import { getHabitsPage } from '#lib/habitspage.svelte.js';

  // A habit's Edit form: its label, times a day, order and aim (do or avoid). Save sends them all (as app.'s form); a refusal is
  // said under the form and what was typed stays. Lists' forms have no Undo.
  let { h }: { h: ListHabit } = $props();
  const page = getHabitsPage();
  const d = $derived(page.draft!);
  const lim = $derived(page.habits!.limits);
  const err = $derived(page.err?.where === `edit:${h.name}` ? page.err.text : null);
  const busy = $derived(!!page.busy[`edit:${h.name}`]);

  const field = 'h-11 min-w-0 rounded-lg border border-line bg-panel px-3 text-base text-text desktop:h-9 desktop:text-sm';
  const btn = 'min-h-11 cursor-pointer rounded-lg px-4 font-medium disabled:opacity-60 desktop:min-h-9';
</script>

<form
  method="POST"
  action="?/habits_manage"
  class="m-0 flex flex-col gap-2.5 rounded-lg border border-line bg-panel2 p-3"
  onsubmit={(e) => {
    e.preventDefault();
    void page.saveEdit(h.name);
  }}
  data-edit-form={h.name}
>
  <label class="flex flex-col gap-1 text-xs text-muted">
    Name
    <input name="label" bind:value={d.label} maxlength={lim.label_max} required autocomplete="off" class="{field} text-text" aria-label="Name of {h.label}" />
  </label>
  <div class="grid grid-cols-2 gap-2.5">
    <label class="flex flex-col gap-1 text-xs text-muted">
      Times a day
      <input name="target" type="text" inputmode="numeric" maxlength="2" autocomplete="off" bind:value={d.target} class="{field} num text-text" aria-label="Times a day for {h.label}" />
    </label>
    <label class="flex flex-col gap-1 text-xs text-muted">
      Order
      <input name="order" type="text" inputmode="numeric" maxlength="3" autocomplete="off" bind:value={d.order} class="{field} num text-text" aria-label="Order of {h.label}" />
    </label>
  </div>
  <label class="flex flex-col gap-1 text-xs text-muted">
    Aim
    <select name="aim" bind:value={d.aim} class="{field} text-text" aria-label="Aim of {h.label}">
      <option value="do">do it</option>
      <option value="avoid">avoid it</option>
    </select>
  </label>
  {#if err}<p class="m-0 text-[13px] text-amber" role="alert" data-refusal>{err}</p>{/if}
  <div class="flex gap-2">
    <button type="submit" class="{btn} border-0 bg-text text-bg" disabled={busy}>Save</button>
    <button type="button" class="{btn} border border-line bg-panel text-text" onclick={() => page.closePanel()}>Cancel</button>
  </div>
</form>
