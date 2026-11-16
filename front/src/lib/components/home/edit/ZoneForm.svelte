<script lang="ts">
  import { getEditPage } from '#lib/homeedit.svelte.js';

  // A zone's form (app.'s "Rename or change the zone" and "+ New zone"): name, tile label, spots (one per line; the steps of a
  // whole-flat chore here), the words you call it. A refusal (a name already in use, ...) is said here and what was typed stays.
  let { k, label, save, note = null }: { k: string; label: string; save: () => void; note?: string | null } = $props();
  const page = getEditPage();
  const lim = $derived(page.edit!.limits);
  const d = $derived(page.zones[k]);
  const err = $derived(page.errs[k]);

  const field = 'h-11 w-full min-w-0 rounded-lg border border-line bg-panel px-3 text-base text-text desktop:h-9 desktop:text-sm';
  const area = 'w-full min-w-0 rounded-lg border border-line bg-panel px-3 py-2 text-base text-text desktop:text-sm';
</script>

{#if d}
  <form
    method="POST"
    novalidate
    class="m-0 flex flex-col gap-2.5 rounded-lg border border-blue bg-panel2 p-3"
    onsubmit={(e) => (e.preventDefault(), save())}
    data-zone-form={k}
  >
    <label class="flex flex-col gap-1 text-[13px] text-muted">
      Name
      <input name="name" maxlength={lim.zone_name_max} autocomplete="off" placeholder="e.g. Balcony" bind:value={page.zones[k]!.name} class={field} data-f="name" />
    </label>
    <label class="flex flex-col gap-1 text-[13px] text-muted">
      Tile label{k === 'newzone' ? ' (optional)' : ''}
      <input name="short" maxlength={lim.short_max} autocomplete="off" bind:value={page.zones[k]!.short} class={field} data-f="short" />
    </label>
    <label class="flex flex-col gap-1 text-[13px] text-muted">
      {k === 'newzone' ? 'Spots (one per line, optional)' : 'Spots (one per line; the steps of a whole-flat chore here)'}
      <textarea name="spots" rows="3" maxlength="600" bind:value={page.zones[k]!.spots} class={area} data-f="spots"></textarea>
    </label>
    <label class="flex flex-col gap-1 text-[13px] text-muted">
      Other words for typed lines
      <input name="words" maxlength="500" autocomplete="off" placeholder="e.g. terrace" bind:value={page.zones[k]!.words} class={field} data-f="words" />
    </label>
    {#if err}<p role="alert" class="m-0 text-[13px] text-amber" data-err>{err}</p>{/if}
    <div class="flex flex-wrap items-center gap-2.5">
      <button
        type="submit"
        class="min-h-11 cursor-pointer rounded-lg border-0 bg-text px-5 font-medium text-bg disabled:opacity-60 desktop:min-h-9"
        disabled={!!page.busy[`save:${k}`]}
        data-save={k}>{label}</button
      >
      {#if note}<span class="text-[13px] text-muted">{note}</span>{/if}
    </div>
  </form>
{/if}
