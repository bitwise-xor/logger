<script lang="ts">
  import HabitCalendar from '#lib/components/habits/HabitCalendar.svelte';
  import { dayName, fullText, type Habits } from '#lib/habits.js';
  import { getHabitsPage } from '#lib/habitspage.svelte.js';

  // The last 30 days (app.'s calendar): per tracked habit its label, "full/30" (or "n/30 without" for a habit to avoid) and a strip
  // of 30 small squares: done, partly, a day a habit to avoid was logged, nothing. The squares are not buttons (too small to
  // tap): the row is; it opens the habit's calendar in weeks (HabitCalendar.svelte), where a day is ticked or unticked.
  let { habits }: { habits: Habits } = $props();
  const page = getHabitsPage();

  const sq = {
    done: 'bg-text',
    partly: 'bg-text/45',
    logged: 'bg-amber',
    none: 'bg-line',
  } as const;
  const dm = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.`;
</script>

<section aria-labelledby="thirty-h" class="flex flex-col rounded-card border border-line bg-panel px-3 pt-3 pb-3 desktop:px-3.5" data-card="thirty">
  <h2 id="thirty-h" class="m-0 pb-1 text-[15px] font-semibold">Last {habits.days} days</h2>
  {#if !habits.calendar.length}
    <p class="m-0 border-t border-line pt-2.5 text-muted">No habit is tracked. Switch Track on for one in Your habits.</p>
  {/if}
  {#each habits.calendar as c (c.name)}
    {@const on = page.open === c.name}
    <div class="border-t border-line" data-cal={c.name}>
      <button
        type="button"
        class="flex min-h-12 w-full cursor-pointer flex-col justify-center gap-1.5 border-0 bg-transparent px-0 py-2 text-left text-text"
        aria-expanded={on}
        onclick={() => page.toggle(c.name)}
        data-cal-row={c.name}
      >
        <span class="flex items-baseline gap-2">
          <span class="min-w-0 flex-1 break-words">{c.label}{#if c.avoid}{' '}<span class="text-xs text-muted">avoid</span>{/if}</span>
          <span class="num text-xs whitespace-nowrap text-muted" data-full>{fullText(c)}</span>
          <span aria-hidden="true" class="text-muted transition-transform {on ? 'rotate-90' : ''}">›</span>
        </span>
        <span aria-hidden="true" class="grid grid-cols-[repeat(30,minmax(0,1fr))] gap-[2px]" data-strip>
          {#each c.days as d (d.day)}
            <span class="h-3.5 rounded-[2px] {sq[d.state]}" title="{dayName(d.day)}: {d.text}" data-sq={d.state}></span>
          {/each}
        </span>
      </button>
      {#if on}<HabitCalendar cal={c} />{/if}
    </div>
  {/each}
  {#if habits.calendar.length}
    <div class="flex justify-between border-t border-line pt-1.5 text-[11px] text-muted" aria-hidden="true"><span>{dm(habits.start)}</span><span>today</span></div>
    <p class="m-0 flex flex-wrap items-center gap-x-3 gap-y-1 pt-2 text-xs text-muted" data-legend>
      <span class="inline-flex items-center gap-1.5"><i class="inline-block h-3 w-3 rounded-[2px] {sq.done}"></i>done</span>
      <span class="inline-flex items-center gap-1.5"><i class="inline-block h-3 w-3 rounded-[2px] {sq.partly}"></i>partly</span>
      <span class="inline-flex items-center gap-1.5"><i class="inline-block h-3 w-3 rounded-[2px] {sq.logged}"></i>a habit to avoid, logged</span>
      <span class="inline-flex items-center gap-1.5"><i class="inline-block h-3 w-3 rounded-[2px] {sq.none}"></i>nothing</span>
    </p>
    <p class="m-0 pt-1.5 text-xs text-muted">
      Tap a habit to open its calendar, then tap a day to tick it; tap a done day to take its ticks off. A tick for a past day has no time of its own.
    </p>
  {/if}
</section>
