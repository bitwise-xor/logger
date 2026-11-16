<script lang="ts">
  import { canChange, cellLabel, cellMark, cellNumber, dayName, isFull, readOnlyWhy, WEEK_HEAD, weeks, type CalHabit } from '#lib/habits.js';
  import { getHabitsPage } from '#lib/habitspage.svelte.js';

  // One habit's last 30 days laid out in weeks, Monday first, a cell of at least 44 px (the owner chose this over app.'s 30 tiny
  // squares, which are too small to tap). A tap on a day ticks it, or takes its ticks off when it is done (habit_day); a habit that
  // wants more than one tick a day shows "1/2" in the cell. A habit the read marks as not editable opens read-only, with a line.
  let { cal }: { cal: CalHabit } = $props();
  const page = getHabitsPage();
  const rows = $derived(weeks(cal.days));
  const why = $derived(readOnlyWhy(cal));
  const first = $derived(cal.days[0]?.day);

  const cell = 'relative flex h-12 min-h-11 w-full flex-col items-center justify-center rounded-lg border p-0';
  const look = {
    done: 'border-text bg-text text-bg',
    partly: 'border-text/50 bg-text/15 text-text',
    logged: 'border-amber bg-amber-bg text-amber',
    none: 'border-line bg-panel2 text-text',
  } as const;
</script>

<div class="flex flex-col gap-1.5 pb-3" data-calendar={cal.name}>
  {#if why}<p class="m-0 text-[13px] text-muted" data-readonly>{why}</p>{/if}
  <div class="mx-auto flex w-full max-w-[460px] flex-col gap-[3px]">
    <div class="grid grid-cols-7 gap-[3px] text-center text-[11px] text-muted" aria-hidden="true">
      {#each WEEK_HEAD as w (w)}<span>{w}</span>{/each}
    </div>
    {#each rows as week, w (w)}
      <div class="grid grid-cols-7 gap-[3px]">
        {#each week as d, i (i)}
          {#if !d}
            <span aria-hidden="true"></span>
          {:else}
            {@const mark = cellMark(d, cal)}
            {@const id = `day:${cal.name}:${d.day}`}
            {@const edge = page.changedDay === `${cal.name}:${d.day}` ? 'ring-2 ring-blue' : d.day === page.habits?.today ? 'border-blue!' : ''}
            {#if why === null && page.habits && canChange(page.habits, d.day)}
              <form method="POST" action="?/habit_day" class="m-0" onsubmit={page.submit('habit_day', id)}>
                <input type="hidden" name="name" value={cal.name} />
                <input type="hidden" name="day" value={d.day} />
                <button
                  type="submit"
                  class="{cell} {look[d.state]} {edge} cursor-pointer disabled:cursor-default disabled:opacity-60"
                  aria-label={cellLabel(cal, d)}
                  aria-pressed={isFull(d, cal)}
                  title="{dayName(d.day)}: {d.text}"
                  disabled={page.busy[id]}
                  data-day={d.day}
                  data-state={d.state}
                >
                  <span class="num absolute top-0.5 left-1 text-[10px] leading-none opacity-75">{cellNumber(d.day, d.day === first)}</span>
                  <span class="num pt-2 text-[13px] leading-none" data-mark>{mark}</span>
                </button>
              </form>
            {:else}
              <span class="{cell} {look[d.state]} {edge} opacity-80" role="img" aria-label={cellLabel(cal, d)} data-day={d.day} data-state={d.state}>
                <span class="num absolute top-0.5 left-1 text-[10px] leading-none opacity-75">{cellNumber(d.day, d.day === first)}</span>
                <span class="num pt-2 text-[13px] leading-none">{mark}</span>
              </span>
            {/if}
          {/if}
        {/each}
      </div>
    {/each}
  </div>
</div>
