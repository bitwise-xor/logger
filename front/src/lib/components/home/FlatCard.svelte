<script lang="ts">
  import { choreHref } from '#lib/home.js';
  import { getZonesPage } from '#lib/homezones.svelte.js';
  import { ALL_DONE_TITLE, allDoneText, FLAT_NOTE, tileLabel, tileTitle } from '#lib/homeparts.js';
  import { pairKey } from '#lib/home.js';

  // "Whole flat" (app.'s _flat; the mockup's second card): per whole-flat chore its name (its page), the per-zone line, "All done"
  // ("All done ✓" once every zone is done today; a second tap takes it back) and a tile per zone, four to a row, with the zone's
  // short label and short age, tinted as the door says. A tap on a tile ticks that zone (a second tap takes it back); both save in
  // place with Undo.
  const page = getZonesPage();
  const flat = $derived(page.zones?.flat ?? []);
</script>

{#if flat.length}
  <section aria-labelledby="flat-h" class="flex flex-col gap-2.5 rounded-card border border-line bg-panel p-3 desktop:p-3.5" data-card="flat">
    <h2 id="flat-h" class="m-0 text-[15px] font-semibold">Whole flat</h2>
    <p class="m-0 text-[13px] text-muted">{FLAT_NOTE}</p>
    {#each flat as f (f.chore_id)}
      {@const all = page.allDone(f)}
      <div class="flex flex-col gap-2 border-t border-line pt-2.5" data-flat={f.chore_id}>
        <div class="flex items-start justify-between gap-2">
          <h3 class="m-0 min-w-0 flex-1 text-base leading-snug font-semibold break-words">
            <a href={choreHref(f.chore_id)} class="inline-flex min-h-11 items-center text-text no-underline hover:underline desktop:min-h-9" data-flat-link>{f.name}</a>
            <span class="text-[13px] font-normal text-muted" data-flat-line>· {f.per_zone.text}</span>
          </h3>
          <button
            type="button"
            class="min-h-11 shrink-0 cursor-pointer rounded-lg border px-3.5 text-sm font-medium disabled:cursor-default disabled:opacity-60 desktop:min-h-9 {all
              ? 'border-blue bg-blue-bg text-blue'
              : 'border-line bg-panel text-text hover:bg-panel2'}"
            aria-pressed={all ? 'true' : undefined}
            title={all ? ALL_DONE_TITLE : undefined}
            disabled={!!page.busy[`alldone:${f.chore_id}`]}
            onclick={() => page.doAllDone(f)}
            data-alldone={f.chore_id}>{allDoneText(f, all)}</button
          >
        </div>
        <div class="grid grid-cols-4 gap-1.5" data-tiles>
          {#each f.tiles as t (t.zone_id)}
            {@const on = page.tinted(t)}
            <button
              type="button"
              class="flex min-h-11 min-w-0 cursor-pointer flex-col items-center justify-center rounded-lg border px-1 py-1.5 text-center disabled:cursor-default disabled:opacity-60 desktop:min-h-[52px] {on
                ? 'border-blue bg-blue-bg text-blue'
                : 'border-line bg-panel2 text-text hover:bg-panel'}"
              title={tileTitle(t)}
              aria-label={tileLabel(t)}
              aria-pressed={page.done(t)}
              disabled={!!page.busy[`tick:${pairKey(t)}`]}
              onclick={() => page.tick(t)}
              data-tile={pairKey(t)}
              data-tinted={on ? 'true' : 'false'}
            >
              <b class="w-full truncate text-sm font-medium" data-tile-short>{t.short}</b>
              <span class="w-full truncate text-xs {on ? 'text-blue' : 'text-muted'}" data-tile-age>{page.age(t)}</span>
            </button>
          {/each}
        </div>
      </div>
    {/each}
  </section>
{/if}
