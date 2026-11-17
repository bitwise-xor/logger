<script lang="ts">
  import FoodEditor from '#lib/components/food/FoodEditor.svelte';
  import { timeline, type Day } from '#lib/day.js';
  import { getToday } from '#lib/today.svelte.js';

  let { day }: { day: Day } = $props();

  const today = getToday();
  const blocks = $derived(timeline(day));

  // Deploy 117: a meal's totals and its foods' numbers in the same four columns (protein, fat, carbs, kcal), right-aligned. The
  // widths are set once on the section (--cn a gram column, --ck the kcal one, --cg the gap between them, --ct the time) and the
  // meal's line leaves on its right what a row's border and padding take (1 + 8 px on phones, 1 + 12 px on the PC), so the columns
  // stand under each other. Phones (375 px): the name keeps about 120 px and wraps; "C 136" and "1,234 kcal" fit their columns.
  const cols = 'grid shrink-0 grid-cols-[var(--cn)_var(--cn)_var(--cn)_var(--ck)] gap-x-[var(--cg)] text-right *:justify-self-end *:whitespace-nowrap';
  const line = 'grid w-full grid-cols-[var(--ct)_minmax(0,1fr)_auto] items-baseline content-center gap-x-1.5 desktop:gap-x-3';
</script>

<section
  aria-labelledby="day-h"
  class="flex flex-col gap-1.5 [--cg:2px] [--ck:62px] [--cn:32px] [--ct:33px] desktop:[--cg:8px] desktop:[--ck:84px] desktop:[--cn:52px] desktop:[--ct:44px]"
  data-card="timeline"
>
  <h2 id="day-h" class="m-0 text-[15px] font-semibold">Your day</h2>
  {#if blocks.length === 0}
    <p class="m-0 text-muted">Nothing logged {day.past ? 'on this day' : 'yet today'}.</p>
  {/if}
  {#each blocks as b (b.key)}
    <!-- The meal's line: its label, and on the right its totals (the owner, 17.11.2026). -->
    <div class="flex items-baseline justify-between gap-2 pt-2 pr-[9px] pl-0.5 text-xs font-medium text-muted desktop:pr-[13px]" data-meal-label>
      <span class="tracking-[0.06em] uppercase">{b.label}</span>
      {#if b.cols}
        <span class="num {cols} text-[10.5px] desktop:text-xs" data-meal-cols
          ><span>{b.cols.protein}</span><span>{b.cols.fat}</span><span>{b.cols.carbs}</span><span>{b.cols.kcal}</span></span
        >
      {/if}
    </div>
    {#each b.lines as r (r.ref)}
      {@const fresh = today.fresh.has(r.ref)}
      {#if r.row && r.cols}
        <!-- A food: one line; a tap opens it in place to change or delete it, with the Food day's editor (deploy 117). -->
        {@const open = today.open === r.ref}
        <div
          class="overflow-hidden rounded-lg border bg-panel transition-colors duration-[600ms] {open || fresh ? 'border-blue' : 'border-line'}"
          data-row={r.ref}
          data-fresh={fresh ? '' : undefined}
        >
          <button
            type="button"
            class="{line} min-h-11 cursor-pointer border-0 bg-transparent px-2 py-2 text-left desktop:px-3 text-text hover:bg-panel2 {open ? 'bg-panel2' : ''}"
            aria-expanded={open}
            onclick={() => today.toggle(r.ref)}
            data-row-line
          >
            <span class="num text-[11px] text-muted desktop:text-xs">{r.time}</span>
            <span class="min-w-0 break-words {open ? 'font-medium' : ''}"
              >{r.name} <span class="num text-xs font-normal whitespace-nowrap text-muted" data-row-amount>{r.amount}</span></span
            >
            <span class="num {cols} text-xs text-muted desktop:text-[13px]" data-row-cols
              ><span>{r.cols.protein}<span class="sr-only"> g protein,</span></span><span>{r.cols.fat}<span class="sr-only"> g fat,</span></span
              ><span>{r.cols.carbs}<span class="sr-only"> g carbs,</span></span><span class="text-[13px] desktop:text-sm {r.review ? 'text-amber' : 'text-text'}" data-kcal
                >{r.cols.kcal}<span class="sr-only"> kcal</span></span
              ></span
            >
          </button>
          {#if open}
            <FoodEditor row={r.row} host={today} />
          {/if}
        </div>
      {:else}
        <!-- Not food (mood, a nap, a tape measure): as before (its time where the foods' is). -->
        <div
          class="grid min-h-11 grid-cols-[var(--ct)_minmax(0,1fr)_auto] items-center gap-1.5 rounded-lg border bg-panel px-2 py-2 text-text transition-colors duration-[600ms] desktop:gap-3 desktop:px-3 {fresh
            ? 'border-blue'
            : 'border-line'}"
          data-row={r.ref}
          data-fresh={fresh ? '' : undefined}
        >
          <span class="num text-[11px] text-muted desktop:text-xs">{r.time}</span>
          <span class="flex min-w-0 flex-col">
            <span class="break-words">{r.name}</span>
            {#if r.sub}<span class="text-xs text-muted">{r.sub}</span>{/if}
          </span>
          <span class="num text-[13px] whitespace-nowrap {r.review ? 'text-amber' : ''}">{r.value}</span>
        </div>
      {/if}
    {/each}
  {/each}
</section>
