<script lang="ts">
  import FoodEditor from '#lib/components/food/FoodEditor.svelte';
  import { foodBlocks, type FoodDay } from '#lib/food.js';
  import { n } from '#lib/format.js';
  import { getFoodPage } from '#lib/foodday.svelte.js';

  let { day }: { day: FoodDay } = $props();
  const food = getFoodPage();
  const blocks = $derived(foodBlocks(day));

  // One grid for both widths: the phone shows time, food and kcal (the mockup's cards); the PC one table with every column.
  const cols = 'grid-cols-[44px_minmax(0,1fr)_auto] desktop:grid-cols-[64px_minmax(0,1fr)_128px_72px_72px_64px_64px_48px]';
  const pc = 'hidden text-right desktop:block';
</script>

<section aria-labelledby="food-rows-h" class="flex flex-col gap-1.5 desktop:gap-0 desktop:overflow-hidden desktop:rounded-card desktop:border desktop:border-line desktop:bg-panel" data-card="food-rows">
  <h2 id="food-rows-h" class="m-0 text-xs font-normal text-muted desktop:sr-only">Tap a food to change its amount, time or note, or to delete it.</h2>
  {#if blocks.length === 0}
    <p class="m-0 text-muted desktop:px-3.5 desktop:py-3">Nothing logged {day.past ? 'on this day' : 'yet today'}.</p>
  {:else}
    <div class="hidden {cols} items-center gap-3 px-3.5 py-2.5 text-xs font-medium text-muted desktop:grid" aria-hidden="true">
      <span>Time</span><span>Food</span><span class="text-right">Amount</span><span class="text-right">kcal</span><span class="text-right">Protein</span><span class="text-right">Fat</span><span class="text-right">Carbs</span><span></span>
    </div>
  {/if}
  {#each blocks as b (b.key)}
    <div
      class="flex justify-between px-0.5 pt-2 text-xs font-medium tracking-[0.06em] text-muted uppercase desktop:border-t desktop:border-line desktop:bg-panel2 desktop:px-3.5 desktop:py-2"
      data-meal-label
    >
      <span>{b.label}</span><span class="num">{b.total}</span>
    </div>
    {#each b.lines as l (l.ref)}
      {@const open = food.open === l.ref}
      {@const fresh = food.fresh.has(l.ref)}
      <div
        class="overflow-hidden rounded-lg border bg-panel transition-colors duration-[600ms] desktop:rounded-none desktop:border-0 desktop:border-t desktop:border-line desktop:bg-transparent {open ||
        fresh
          ? 'border-blue'
          : 'border-line'} {fresh ? 'desktop:shadow-[inset_3px_0_0_var(--color-blue)]' : ''}"
        data-row={l.ref}
        data-fresh={fresh ? '' : undefined}
      >
        <button
          type="button"
          class="grid min-h-[52px] w-full cursor-pointer {cols} items-center gap-2.5 border-0 bg-transparent px-3 py-1.5 text-left text-text desktop:min-h-11 desktop:gap-3 desktop:px-3.5 {open
            ? 'desktop:bg-blue-bg'
            : ''}"
          aria-expanded={open}
          onclick={() => food.toggle(l.ref)}
        >
          <span class="num text-xs text-muted desktop:text-[13px]">{l.time}</span>
          <span class="flex min-w-0 flex-col">
            <span class="break-words desktop:truncate {open ? 'desktop:font-medium' : ''}">{l.name}</span>
            <span class="num text-xs text-muted desktop:hidden">{l.sub}</span>
            {#if l.note}<span class="text-xs text-muted" data-note>Note: {l.note}</span>{/if}
          </span>
          <span class="num {pc}">{l.amount}</span>
          <span class="num text-[13px] whitespace-nowrap desktop:text-right desktop:text-sm" data-kcal
            >{n(l.row.nutrients.kcal)}<span class="desktop:hidden">{' kcal'}</span></span
          >
          <span class="num {pc}">{l.protein}</span>
          <span class="num {pc}">{l.fat}</span>
          <span class="num {pc}">{l.carbs}</span>
          <span class="{pc} text-[13px] text-muted">{open ? 'Close' : 'Edit'}</span>
        </button>
        {#if open}
          <FoodEditor row={l.row} />
        {/if}
      </div>
    {/each}
  {/each}
  {#if blocks.length}
    <div class="hidden {cols} items-center gap-3 border-t border-line px-3.5 py-2.5 font-semibold desktop:grid" data-total>
      <span></span><span>Total</span><span></span>
      <span class="num text-right">{n(day.totals.kcal)}</span>
      <span class="num text-right">{n(day.totals.protein)} g</span>
      <span class="num text-right">{n(day.totals.fat)} g</span>
      <span class="num text-right">{n(day.totals.carbs)} g</span>
      <span></span>
    </div>
  {/if}
</section>
