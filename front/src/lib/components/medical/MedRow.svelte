<script lang="ts">
  import { medFrom, medLine, type Med } from '#lib/medical.js';
  import { getMedsPage } from '#lib/medspage.svelte.js';

  // A course of the list (the mockup's row), the door's order: the name with the ingredient muted, "dose · how often · for why", "start to"
  // and the stop date or the pill "running"; a pencil (dose, how often, why, start and stop; the stop empty = running; shown first by the
  // door, Yes in the answer bar) and, for a running course with no stop date, End (the bar asks "Yes, end it today"). A refusal or "Nothing
  // changed." is said next to the form (or on the row, for End), which keeps what was typed.
  let { m, hint }: { m: Med; hint: string } = $props();
  const page = getMedsPage();
  const edit = $derived(page.editing === m.id);
  const fresh = $derived(page.fresh === m.id);
  const limits = $derived(page.meds!.limits);
  const busy = (id: string) => !!page.busy[id];

  const field = 'h-11 w-full min-w-0 rounded-lg border border-line bg-panel px-3 text-base text-text placeholder:text-muted desktop:h-9 desktop:text-sm';
  const btn = 'min-h-11 shrink-0 cursor-pointer rounded-lg px-4 font-medium disabled:opacity-60 desktop:min-h-9';
  const err = $derived(page.errs[`med:${m.id}`]);
</script>

<div class="flex flex-col gap-2 px-3 py-3 transition-colors duration-500 desktop:px-3.5 {fresh ? 'shadow-[inset_3px_0_0_var(--color-blue)]' : ''}" data-med={m.id} data-fresh={fresh ? '' : undefined} data-running={m.running ? '' : undefined}>
  <div class="flex items-start gap-2">
    <div class="flex min-w-0 flex-1 flex-col gap-1">
      <span class="break-words {m.running ? '' : 'text-muted'}" data-med-name>
        <span class="font-medium">{m.name}</span>{#if m.ingredient}{' '}<span class="text-[13px] text-muted" data-med-ingredient>{m.ingredient}</span>{/if}
      </span>
      {#if medLine(m)}<span class="num text-[13px] break-words {m.running ? '' : 'text-muted'}" data-med-line>{medLine(m)}</span>{/if}
      <span class="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[13px] text-muted" data-med-span>
        <span class="num">{medFrom(m)}</span>
        {#if m.running && !m.stop_text}
          <span class="rounded-full bg-panel2 px-2.5 py-0.5 text-xs" data-pill="running">running</span>
        {:else if m.stop_text}
          <span class="num">{m.stop_text}</span>{#if m.running}<span class="rounded-full bg-panel2 px-2.5 py-0.5 text-xs" data-pill="running">running</span>{/if}
        {/if}
      </span>
    </div>
    <div class="flex shrink-0 items-center gap-1">
      {#if m.can_end}
        <button type="button" class="{btn} border border-line bg-transparent text-text" disabled={busy(`end:${m.id}`) || busy('confirm:labs_med')} onclick={() => page.end(m)} data-end={m.id}>End</button>
      {/if}
      <button
        type="button"
        aria-label="Change {m.name}"
        aria-expanded={edit}
        class="flex size-11 cursor-pointer items-center justify-center rounded-lg border-0 bg-transparent text-muted hover:text-text desktop:size-9 {edit ? 'text-text' : ''}"
        onclick={() => page.pencil(m)}
        data-pencil={m.id}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"
          ><path d="M12 20h9"></path><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z"></path></svg
        >
      </button>
    </div>
  </div>
  {#if err && !edit}<p role="alert" class="m-0 rounded-lg bg-amber-bg px-2.5 py-2 text-[13px] text-amber" data-err="med:{m.id}">{err}</p>{/if}
  {#if edit}
    <form
      method="POST"
      action="?/labs_med"
      class="m-0 flex flex-col gap-2.5 rounded-lg border border-line bg-panel2 p-2.5"
      novalidate
      onsubmit={(e) => (e.preventDefault(), page.saveMed(m))}
      data-form="med"
    >
      <div class="grid grid-cols-1 gap-2 tablet:grid-cols-3">
        <label class="flex min-w-0 flex-col gap-1 text-xs text-muted">
          Dose
          <input name="dose" maxlength={limits.dose_max} autocomplete="off" bind:value={page.draft.dose} oninput={() => delete page.errs[`med:${m.id}`]} class="{field} num" data-edit="dose" />
        </label>
        <label class="flex min-w-0 flex-col gap-1 text-xs text-muted">
          How often
          <input name="frequency" maxlength={limits.frequency_max} autocomplete="off" bind:value={page.draft.frequency} oninput={() => delete page.errs[`med:${m.id}`]} class={field} data-edit="frequency" />
        </label>
        <label class="flex min-w-0 flex-col gap-1 text-xs text-muted">
          Why
          <input name="indication" maxlength={limits.indication_max} autocomplete="off" bind:value={page.draft.indication} oninput={() => delete page.errs[`med:${m.id}`]} class={field} data-edit="indication" />
        </label>
      </div>
      <div class="grid grid-cols-2 gap-2">
        <label class="flex min-w-0 flex-col gap-1 text-xs text-muted">
          Start
          <input name="start" type="date" bind:value={page.draft.start} oninput={() => delete page.errs[`med:${m.id}`]} class="{field} num" data-edit="start" />
        </label>
        <label class="flex min-w-0 flex-col gap-1 text-xs text-muted">
          Stop (empty = running)
          <input name="stop" type="date" bind:value={page.draft.stop} oninput={() => delete page.errs[`med:${m.id}`]} class="{field} num" data-edit="stop" />
        </label>
      </div>
      {#if err}<p role="alert" class="m-0 rounded-lg bg-amber-bg px-2.5 py-2 text-[13px] text-amber" data-err="med:{m.id}">{err}</p>{/if}
      <div class="flex flex-wrap items-center gap-x-3 gap-y-2">
        <button type="submit" class="{btn} border-0 bg-text text-bg" disabled={busy(`med:${m.id}`) || busy('confirm:labs_med')} data-save-med>Save</button>
        <button type="button" class="{btn} border border-line bg-panel text-text" onclick={() => page.pencil(m)}>Cancel</button>
        <span class="min-w-0 flex-1 basis-48 text-xs text-muted">{hint}</span>
      </div>
    </form>
  {/if}
</div>
