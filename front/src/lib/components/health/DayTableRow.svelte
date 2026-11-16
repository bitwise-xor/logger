<script lang="ts">
  import { changedRows, clears, dayLine, draftOf, saveFields, type Column, type HealthDay } from '#lib/health.js';
  import { getHealthPage } from '#lib/healthpage.svelte.js';
  import { untrack } from 'svelte';

  // A day as a row of the table (from 1100 px, app.'s Entries): every value in a field, the sleep, Save (or Enter in a field).
  // Only the changed rows of the day are sent (the door's health_day); Save shows once something changed.
  let { day, columns }: { day: HealthDay; columns: Column[] } = $props();
  const page = getHealthPage();

  const before = untrack(() => draftOf(day));
  let draft = $state({ ...before });
  const line = $derived(dayLine(day, columns));
  const changed = $derived(changedRows(before, draft));
  const busy = $derived(!!page.busy[`day:${day.day}`]);
  const fresh = $derived(page.fresh.has(day.day));
  const fid = $derived(`hrow-${day.day}`);

  function save(event: SubmitEvent) {
    event.preventDefault();
    if (!changed.length) return;
    void page.tap('health_day', `day:${day.day}`, { day: day.day, ...saveFields(before, draft), ...(clears(before, draft) ? { clears: '1' } : {}) });
  }

  const field = 'num h-9 rounded-md border border-line bg-panel px-1.5 text-center text-sm text-text';
</script>

<tr class="border-t border-line {fresh ? 'shadow-[inset_3px_0_0_var(--color-blue)]' : ''} {changed.length ? 'bg-blue-bg' : ''}" data-table-day={day.day} data-fresh={fresh ? '' : undefined}>
  <td class="num py-1.5 pr-2 pl-3.5 whitespace-nowrap">{line.label}</td>
  {#each columns as c (c.row)}
    <td class="px-1 py-1.5 whitespace-nowrap">
      {#if c.kind === 'pair'}
        <input form={fid} name="{c.row}_1" inputmode="numeric" autocomplete="off" placeholder="–" aria-label="{c.label} {c.sub}, upper, {line.label}" bind:value={draft[`${c.row}_1`]} class="{field} w-11" /><span class="px-0.5 text-muted">/</span><input form={fid} name="{c.row}_2" inputmode="numeric" autocomplete="off" placeholder="–" aria-label="{c.label} {c.sub}, lower, {line.label}" bind:value={draft[`${c.row}_2`]} class="{field} w-11" />
      {:else if c.kind === 'time'}
        <input form={fid} name={c.row} type="time" aria-label="{c.label}, {line.label}" bind:value={draft[c.row]} class="{field} w-[116px]" />
      {:else}
        <input form={fid} name={c.row} inputmode="decimal" autocomplete="off" placeholder="–" aria-label="{c.label}, {line.label}" bind:value={draft[c.row]} class="{field} {c.row === 'mood' || c.row === 'energy' ? 'w-10' : 'w-14'}" />
      {/if}
    </td>
  {/each}
  <td class="num px-2 py-1.5 text-[13px] whitespace-nowrap text-muted" data-slept>{line.slept}</td>
  <td class="py-1.5 pr-3.5 pl-1 text-right">
    <form id={fid} method="POST" action="?/health_day" class="m-0" onsubmit={save}>
      <input type="hidden" name="day" value={day.day} />
      <button type="submit" class="h-9 cursor-pointer rounded-md border-0 px-3 font-medium disabled:cursor-default {changed.length ? 'bg-text text-bg' : 'bg-transparent text-muted'}" disabled={busy || !changed.length}>Save</button>
    </form>
  </td>
</tr>
