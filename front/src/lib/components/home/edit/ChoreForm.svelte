<script lang="ts">
  import { getEditPage } from '#lib/homeedit.svelte.js';
  import { whereOptions } from '#lib/homeparts.js';

  // A chore's form (app.'s _chore_form), for a chore's edit and for "+ New chore": name, where (a zone, or Whole flat), every N days,
  // minutes, steps (one per line), how-to line, the words you call it. The limits are the door's (home_edit's `limits`). The form is
  // not checked by the browser (novalidate): a range or a name the door refuses is said next to the form in its words, and what was
  // typed stays (the numbers are kept as typed text: `value` and `oninput`, since a bound number field would give numbers). `k` is the form's key (c:7 or newchore), `save` its Save or Add.
  let { k, label, save }: { k: string; label: string; save: () => void } = $props();
  const page = getEditPage();
  const edit = $derived(page.edit!);
  const lim = $derived(edit.limits);
  const d = $derived(page.chores[k]);
  const err = $derived(page.errs[k]);
  const options = $derived(d ? whereOptions(edit, d.zone) : []);

  const field = 'h-11 w-full min-w-0 rounded-lg border border-line bg-panel px-3 text-base text-text desktop:h-9 desktop:text-sm';
  const area = 'w-full min-w-0 rounded-lg border border-line bg-panel px-3 py-2 text-base text-text desktop:text-sm';
</script>

{#if d}
  <form
    method="POST"
    novalidate
    class="m-0 flex flex-col gap-2.5 rounded-lg border border-blue bg-panel2 p-3"
    onsubmit={(e) => (e.preventDefault(), save())}
    data-chore-form={k}
  >
    <label class="flex flex-col gap-1 text-[13px] text-muted">
      Name
      <input name="name" maxlength={lim.chore_name_max} autocomplete="off" placeholder="e.g. Clean the oven" bind:value={page.chores[k]!.name} class={field} data-f="name" />
    </label>
    <label class="flex flex-col gap-1 text-[13px] text-muted">
      Where
      <select name="zone_id" bind:value={page.chores[k]!.zone} class={field} data-f="zone">
        {#each options as o (o.value)}<option value={o.value}>{o.label}</option>{/each}
      </select>
    </label>
    <div class="grid grid-cols-2 gap-2">
      <label class="flex flex-col gap-1 text-[13px] text-muted">
        Every … days
        <input
          name="days"
          type="number"
          inputmode="numeric"
          min={lim.days_min}
          max={lim.days_max}
          placeholder="7 = weekly"
          value={d.days}
          oninput={(e) => (page.chores[k]!.days = e.currentTarget.value)}
          class={field}
          data-f="days"
        />
      </label>
      <label class="flex flex-col gap-1 text-[13px] text-muted">
        Minutes
        <input name="minutes" type="number" inputmode="numeric" min={lim.minutes_min} max={lim.minutes_max} value={d.minutes} oninput={(e) => (page.chores[k]!.minutes = e.currentTarget.value)} class={field} data-f="minutes" />
      </label>
    </div>
    <label class="flex flex-col gap-1 text-[13px] text-muted">
      Steps (one per line)
      <textarea name="steps" rows="3" maxlength="700" bind:value={page.chores[k]!.steps} class={area} data-f="steps"></textarea>
    </label>
    <label class="flex flex-col gap-1 text-[13px] text-muted">
      How-to line (optional)
      <input name="howto" maxlength={lim.howto_max} autocomplete="off" bind:value={page.chores[k]!.howto} class={field} data-f="howto" />
    </label>
    <label class="flex flex-col gap-1 text-[13px] text-muted">
      Other words for typed lines
      <input name="words" maxlength="500" autocomplete="off" placeholder="e.g. oven, stove" bind:value={page.chores[k]!.words} class={field} data-f="words" />
    </label>
    {#if err}<p role="alert" class="m-0 text-[13px] text-amber" data-err>{err}</p>{/if}
    <div>
      <button
        type="submit"
        class="min-h-11 cursor-pointer rounded-lg border-0 bg-text px-5 font-medium text-bg disabled:opacity-60 desktop:min-h-9"
        disabled={!!page.busy[`save:${k}`]}
        data-save={k}>{label}</button
      >
    </div>
  </form>
{/if}
