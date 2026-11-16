<script lang="ts">
  import { choreHref, pairKey, rowMeta, tickLabel, type HomeRow } from '#lib/home.js';
  import { zoneRowMeta } from '#lib/homeparts.js';

  /** What a page of Home must offer for the tick circle: Now's page, and Zones' page for the zone cards. */
  interface TickPage {
    done(r: HomeRow): boolean;
    tick(r: HomeRow): Promise<void>;
    busy: Record<string, boolean>;
    changed: string | null;
  }

  // One chore row (app.'s _row): the tick circle saves in place (filled at once with the blue edge; a second tap takes the tick back,
  // as the door's tick toggles a pair done today), the chore's page, "age · interval" in the door's words (plain, never red) and the
  // minutes in this zone. On Now the name is "Chore · Zone" with the age first; in a zone card (`zone`) it is the chore's name alone
  // with the interval first (app.'s zone_first and plain_name).
  let { row, page, zone = false }: { row: HomeRow; page: TickPage; zone?: boolean } = $props();

  const key = $derived(pairKey(row));
  const done = $derived(page.done(row));
  const fresh = $derived(page.changed === key);
  const busy = $derived(!!page.busy[`tick:${key}`]);
</script>

<div class="flex min-h-14 items-center gap-1 border-t border-line first:border-t-0" data-hrow={key} data-done={done ? 'true' : 'false'}>
  <button
    type="button"
    class="-ml-2 flex size-11 shrink-0 cursor-pointer items-center justify-center border-0 bg-transparent p-0 disabled:cursor-default"
    aria-pressed={done}
    aria-label={tickLabel(row, done)}
    disabled={busy}
    onclick={() => page.tick(row)}
    data-tick={key}
  >
    <span
      aria-hidden="true"
      class="flex size-[26px] items-center justify-center rounded-full transition-colors {done
        ? `bg-text text-bg ${fresh ? 'border-2 border-blue ring-2 ring-blue-bg' : 'border-[1.5px] border-text'}`
        : `bg-transparent text-transparent ${fresh ? 'border-2 border-blue' : 'border-[1.5px] border-muted'}`}"
      data-ring={fresh ? 'fresh' : done ? 'done' : 'open'}
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"
        ><path d="M5 12.5l4.5 4.5L19 7.5"></path></svg
      >
    </span>
  </button>
  <a href={choreHref(row.chore_id)} class="group flex min-h-11 min-w-0 flex-1 flex-col justify-center py-1.5 text-text no-underline" data-hlink>
    <span class="font-medium break-words group-hover:underline" data-hlabel>{zone ? row.name : row.label}</span>
    <span class="text-[13px] text-muted" data-hmeta>{zone ? zoneRowMeta(row) : rowMeta(row)}</span>
  </a>
  <span class="num shrink-0 text-[13px] text-muted" data-hmin>{row.minutes} min</span>
</div>
