<script lang="ts">
  import { getEditPage } from '#lib/homeedit.svelte.js';
  import { PER_ZONE_NOTE, keyOf, type EditChore } from '#lib/homeparts.js';

  // "Per zone" of an active whole-flat chore (app.'s _zones_form): each active zone on or off (a zone left off is not done there),
  // its own days and minutes (blank = the chore's own, shown as the placeholder). Save sends the whole table.
  let { c }: { c: EditChore } = $props();
  const page = getEditPage();
  const k = $derived(keyOf.perZone(c.chore_id));
  const rows = $derived(page.perZone[k] ?? []);
  const err = $derived(page.errs[k]);

  const field = 'h-11 w-full min-w-0 rounded-lg border border-line bg-panel px-2 text-base text-text desktop:h-9 desktop:text-sm';
</script>

{#if page.perZone[k]}
  <form method="POST" novalidate class="m-0 flex flex-col gap-2 rounded-lg border border-blue bg-panel2 p-3" onsubmit={(e) => (e.preventDefault(), page.savePerZone(c))} data-pz-form={c.chore_id}>
    <div class="grid grid-cols-[minmax(0,1fr)_72px_72px] items-end gap-x-2 gap-y-1 text-[13px] text-muted">
      <span>Zone</span><span>Every … days</span><span>Minutes</span>
    </div>
    {#each rows as r, i (r.zone_id)}
      <div class="grid grid-cols-[minmax(0,1fr)_72px_72px] items-center gap-x-2" data-pz-row={r.zone_id}>
        <label class="flex min-h-11 min-w-0 cursor-pointer items-center gap-2 break-words">
          <input type="checkbox" class="peer sr-only" bind:checked={page.perZone[k]![i]!.on} data-pz-on={r.zone_id} />
          <span
            aria-hidden="true"
            class="relative inline-block h-6 w-10 shrink-0 rounded-full border border-line bg-panel transition-colors peer-checked:border-blue peer-checked:bg-blue-bg peer-focus-visible:ring-2 peer-focus-visible:ring-blue after:absolute after:top-0.5 after:left-0.5 after:size-4 after:rounded-full after:bg-muted after:transition-all peer-checked:after:left-[18px] peer-checked:after:bg-blue"
          ></span>
          <span>{r.zone}</span>
        </label>
        <input
          type="number"
          inputmode="numeric"
          min="1"
          max="730"
          aria-label="{r.zone}: every … days"
          placeholder={String(c.interval)}
          value={r.days}
          oninput={(e) => (page.perZone[k]![i]!.days = e.currentTarget.value)}
          class={field}
          data-pz-days={r.zone_id}
        />
        <input
          type="number"
          inputmode="numeric"
          min="1"
          max="240"
          aria-label="{r.zone}: minutes"
          placeholder={String(c.minutes)}
          value={r.minutes}
          oninput={(e) => (page.perZone[k]![i]!.minutes = e.currentTarget.value)}
          class={field}
          data-pz-min={r.zone_id}
        />
      </div>
    {/each}
    <p class="m-0 text-[13px] text-muted">{PER_ZONE_NOTE(c)}</p>
    {#if err}<p role="alert" class="m-0 text-[13px] text-amber" data-err>{err}</p>{/if}
    <div>
      <button
        type="submit"
        class="min-h-11 cursor-pointer rounded-lg border-0 bg-text px-5 font-medium text-bg disabled:opacity-60 desktop:min-h-9"
        disabled={!!page.busy[`save:${k}`]}
        data-save={k}>Save</button
      >
    </div>
  </form>
{/if}
