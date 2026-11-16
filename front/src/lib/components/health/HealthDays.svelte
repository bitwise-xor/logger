<script lang="ts">
  import DayEditor from '#lib/components/health/DayEditor.svelte';
  import DayTableRow from '#lib/components/health/DayTableRow.svelte';
  import { dayLine, healthHref, type Health } from '#lib/health.js';
  import { getHealthPage } from '#lib/healthpage.svelte.js';

  // The entries, newest day first (the last 14, or every day of the range with "Show all"). Phones and tablets: a row per day
  // that opens to change (the owner's choice, as a food row on the Food day); from 1100 px: app.'s table, a field per value and
  // a Save per day. A day's row is drawn afresh when its values change (a save), so its fields show what was saved.
  let { health }: { health: Health } = $props();
  const page = getHealthPage();
  const lines = $derived(health.days.map((d) => ({ d, line: dayLine(d, health.columns), key: `${d.day}:${JSON.stringify(d.values)}` })));
  const more = $derived(health.days_in_range > health.shown_days);
</script>

<section aria-labelledby="entries-h" class="flex flex-col gap-1.5 desktop:gap-0 desktop:overflow-hidden desktop:rounded-card desktop:border desktop:border-line desktop:bg-panel" data-card="entries">
  <h2 id="entries-h" class="m-0 pt-1 text-[15px] font-semibold desktop:px-3.5 desktop:pt-3 desktop:pb-2">
    Entries <span class="text-[13px] font-normal text-muted">one row per day, newest first</span>
  </h2>
  <p class="m-0 text-xs text-muted desktop:hidden">Tap a day to change its values.</p>

  <!-- phones and tablets: a row per day -->
  {#each lines as { d, line, key } (key)}
    {@const open = page.open === d.day}
    {@const fresh = page.fresh.has(d.day)}
    <div
      class="overflow-hidden rounded-lg border bg-panel transition-colors duration-[600ms] desktop:hidden {open || fresh ? 'border-blue' : 'border-line'}"
      data-day={d.day}
      data-fresh={fresh ? '' : undefined}
    >
      <button
        type="button"
        class="flex min-h-[52px] w-full cursor-pointer flex-col gap-0.5 border-0 bg-transparent px-3 py-2 text-left text-text"
        aria-expanded={open}
        onclick={() => page.toggle(d.day)}
      >
        <span class="flex w-full items-baseline gap-2">
          <span class="num flex-1 font-medium">{line.label}</span>
          {#if line.slept !== '–'}<span class="num text-xs text-muted" data-slept>Sleep {line.slept}</span>{/if}
        </span>
        <span class="text-[13px] tabular-nums {line.empty ? 'text-muted' : ''}" data-day-values>
          {line.empty ? 'Nothing logged' : line.parts.map((p) => p.text).join(' · ')}
        </span>
      </button>
      {#if open}<DayEditor day={d} columns={health.columns} />{/if}
    </div>
  {/each}

  <!-- from 1100 px: the table -->
  <div class="hidden overflow-x-auto desktop:block">
    <table class="w-full border-collapse text-sm" data-table>
      <thead>
        <tr class="text-left text-xs font-medium text-muted">
          <th class="py-2 pr-2 pl-3.5 font-medium">Day</th>
          {#each health.columns as c (c.row)}
            <th class="px-1 py-2 font-medium whitespace-nowrap">{c.label}{#if c.sub}{' '}<span class="font-normal">{c.sub}</span>{/if}</th>
          {/each}
          <th class="px-2 py-2 font-medium">Sleep</th>
          <th class="pr-3.5"><span class="sr-only">Save</span></th>
        </tr>
      </thead>
      <tbody>
        {#each lines as { d, key } (key)}
          <DayTableRow day={d} columns={health.columns} />
        {/each}
      </tbody>
    </table>
  </div>

  {#if more}
    <p class="m-0 pt-1.5 desktop:px-3.5 desktop:py-2.5">
      <a
        href={healthHref(health.range, { all: !health.all })}
        class="inline-flex min-h-11 items-center rounded-full border border-line bg-panel px-4 text-text no-underline desktop:min-h-9"
        data-show-all>{health.all ? `Show the last ${health.shown_days} days` : `Show all ${health.days_in_range} days`}</a
      >
    </p>
  {/if}
  <p class="m-0 hidden px-3.5 pb-3 text-xs text-muted desktop:block">
    Change a value and press Save or Enter; Save is your yes. An empty cell adds a value for that day; clearing a value deletes it
    (asked once). Odd values still ask. Bed is the evening before; sleep comes from bed and wake-up.
  </p>
</section>
