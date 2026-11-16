<script lang="ts">
  import { healthLines, type Day, type HealthItem } from '#lib/day.js';
  import { hm, plain } from '#lib/format.js';
  import { getToday } from '#lib/today.svelte.js';
  import type { FieldValues } from '#lib/saver.js';

  let { day }: { day: Day } = $props();
  const today = getToday();

  const lines = $derived(healthLines(day));
  const items = $derived(new Map(day.health.map((h) => [h.row, h])));
  /** The row being typed in (one at a time). */
  let open = $state<HealthItem['row'] | null>(null);

  const clock = (h: HealthItem) => h.row === 'bed' || h.row === 'wake';
  const pair = (h: HealthItem) => h.row === 'bp_morning' || h.row === 'bp_evening';

  // A value logged is corrected (its ref); with none, the row logs a new one (docs/API.md, /health). An odd value is read back
  // first: the answer bar asks, and its Yes sends the same again with confirmed.
  async function save(event: SubmitEvent, h: HealthItem) {
    event.preventDefault();
    const fields: FieldValues = {};
    new FormData(event.currentTarget as HTMLFormElement).forEach((v, k) => {
      if (typeof v === 'string' && v.trim() !== '') fields[k] = v.trim();
    });
    const a = await today.tap('health', `health:${h.row}`, fields);
    if (a && a.outcome !== 'rejected') open = null;
  }

  const field =
    'h-11 w-full min-w-0 rounded-lg border border-line bg-panel px-3 text-base text-text desktop:h-9 desktop:text-sm num';
  const btn = 'min-h-11 cursor-pointer rounded-lg px-4 font-medium disabled:opacity-60 desktop:min-h-9';
</script>

<!-- The compact Health card under the timeline (the plan, question 1): tap a row to type its value or time. -->
{#if lines.length}
  <section aria-labelledby="health-h" class="flex flex-col rounded-card border border-line bg-panel px-3 pt-3 pb-1.5 desktop:px-3.5" data-card="health">
    <!-- The Health page (deploy 92): charts, every day's values and the body measurements. -->
    <h2 id="health-h" class="m-0 pb-1 text-[15px] font-semibold">
      <a href="/health" class="inline-flex min-h-11 items-center gap-1 text-text no-underline desktop:min-h-0" data-health-link>Health <span class="text-muted" aria-hidden="true">›</span></a>
    </h2>
    {#each lines as l (l.row)}
      {@const h = items.get(l.row)!}
      <button
        type="button"
        class="flex min-h-11 w-full cursor-pointer items-center gap-3 border-0 border-t border-line bg-transparent px-0 py-1 text-left text-text disabled:cursor-default"
        data-health={l.row}
        aria-expanded={open === l.row}
        disabled={day.past}
        onclick={() => (open = open === l.row ? null : l.row)}
      >
        <span class="flex min-w-0 flex-1 flex-col">
          <span>{l.label}</span>
          {#if l.sub}<span class="text-xs text-muted">{l.sub}</span>{/if}
        </span>
        {#if l.time}<span class="num text-xs text-muted">{l.time}</span>{/if}
        <span class="num text-[13px] whitespace-nowrap {l.value === '–' ? 'text-muted' : ''}">{l.value}</span>
      </button>
      {#if open === l.row && !day.past}
        <form method="POST" action="?/health" class="m-0 flex flex-wrap items-center gap-2 pb-2.5" onsubmit={(e) => save(e, h)} data-health-form={l.row}>
          <input type="hidden" name="row" value={h.row} />
          {#if h.ref}<input type="hidden" name="ref" value={h.ref} />{/if}
          {#if clock(h)}
            <!-- svelte-ignore a11y_autofocus -->
            <input name="time" type="time" required autofocus aria-label="{h.label}, time" value={h.ref ? hm(h.at) : ''} class="{field} max-w-36" />
          {:else if pair(h)}
            <!-- svelte-ignore a11y_autofocus -->
            <input name="v1" inputmode="numeric" required autofocus aria-label="{h.label}, upper" placeholder="upper" value={h.ref && h.v1 !== null ? plain(h.v1) : ''} class="{field} max-w-24" />
            <span class="text-muted">/</span>
            <input name="v2" inputmode="numeric" required aria-label="{h.label}, lower" placeholder="lower" value={h.ref && h.v2 !== null ? plain(h.v2) : ''} class="{field} max-w-24" />
            {#if h.unit}<span class="text-[13px] text-muted">{h.unit}</span>{/if}
          {:else}
            <!-- svelte-ignore a11y_autofocus -->
            <input name="v1" inputmode="decimal" required autofocus aria-label={h.label} value={h.ref && h.v1 !== null ? plain(h.v1) : ''} class="{field} max-w-28" />
            {#if h.unit}<span class="text-[13px] text-muted">{h.unit}</span>{/if}
          {/if}
          <span class="flex flex-1 justify-end gap-2">
            <button type="button" class="{btn} border-0 bg-transparent text-text" onclick={() => (open = null)}>Cancel</button>
            <button type="submit" class="{btn} border-0 bg-text text-bg" disabled={today.busy[`health:${h.row}`]}>{h.ref ? 'Change' : 'Save'}</button>
          </span>
        </form>
      {/if}
    {/each}
  </section>
{/if}
