<script lang="ts">
  import DayFields from '#lib/components/health/DayFields.svelte';
  import { changedRows, clears, draftOf, saveFields, type Column, type HealthDay } from '#lib/health.js';
  import { getHealthPage } from '#lib/healthpage.svelte.js';
  import { untrack } from 'svelte';

  // A day's row opened to change (phones and tablets, as a food row on the Food day): the eight values as fields, one Save for
  // the day (only the changed rows go: the door's health_day), Cancel. A cleared value is asked once, an odd one read back.
  let { day, columns }: { day: HealthDay; columns: Column[] } = $props();
  const page = getHealthPage();

  const before = untrack(() => draftOf(day));
  let draft = $state({ ...before });
  const changed = $derived(changedRows(before, draft));
  const busy = $derived(!!page.busy[`day:${day.day}`]);

  function save(event: SubmitEvent) {
    event.preventDefault();
    if (!changed.length) return;
    void page.tap('health_day', `day:${day.day}`, { day: day.day, ...saveFields(before, draft), ...(clears(before, draft) ? { clears: '1' } : {}) });
  }

  const btn = 'min-h-11 cursor-pointer rounded-lg px-4 font-medium disabled:opacity-60';
</script>

<form method="POST" action="?/health_day" class="m-0 flex flex-col gap-3 border-t border-line bg-panel2 px-3 pt-3 pb-3" onsubmit={save} data-day-editor={day.day}>
  <input type="hidden" name="day" value={day.day} />
  <DayFields {columns} bind:draft day={day.day} />
  <p class="m-0 text-xs text-muted">
    Save is your yes. An empty field adds a value for that day; clearing a value deletes it (asked once). Odd values still ask. Bed is
    the evening before.
  </p>
  <div class="flex gap-2">
    <button type="submit" class="{btn} border-0 bg-text text-bg" disabled={busy || !changed.length}>Save</button>
    <button type="button" class="{btn} border border-line bg-panel text-text" onclick={() => page.toggle(day.day)}>Cancel</button>
  </div>
</form>
