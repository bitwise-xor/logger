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
  <h2 id="food-rows-h" class="m-0 text-xs font-normal text-muted desktop:sr-only">Tap a food to change its amount, time or note, or to delete it. "Save as usual meal" keeps a meal's foods and amounts under a name.</h2>
  {#if blocks.length === 0}
    <p class="m-0 text-muted desktop:px-3.5 desktop:py-3">Nothing logged {day.past ? 'on this day' : 'yet today'}.</p>
  {:else}
    <div class="hidden {cols} items-center gap-3 px-3.5 py-2.5 text-xs font-medium text-muted desktop:grid" aria-hidden="true">
      <span>Time</span><span>Food</span><span class="text-right">Amount</span><span class="text-right">kcal</span><span class="text-right">Protein</span><span class="text-right">Fat</span><span class="text-right">Carbs</span><span></span>
    </div>
  {/if}
  {#each blocks as b (b.key)}
    {@const naming = food.naming === b.meal}
    <div
      class="flex min-h-11 items-center gap-2 px-0.5 pt-1 text-xs font-medium tracking-[0.06em] text-muted uppercase desktop:min-h-0 desktop:border-t desktop:border-line desktop:bg-panel2 desktop:px-3.5 desktop:py-1"
      data-meal-label
    >
      <span>{b.label}</span><span class="num">{b.total}</span>
      <span class="flex-1"></span>
      {#if b.meal !== 0}
        <button
          type="button"
          class="min-h-11 cursor-pointer border-0 bg-transparent px-1 text-[13px] font-medium tracking-normal text-blue normal-case desktop:min-h-8"
          aria-expanded={naming}
          onclick={() => food.nameMeal(b.meal)}
          data-save-usual={b.meal}>Save as usual meal</button
        >
      {/if}
    </div>
    {#if naming}
      <form
        method="POST"
        action="?/usual_from_meal"
        class="m-0 flex flex-col gap-2 rounded-lg border border-blue bg-panel2 px-3 py-2.5 desktop:rounded-none desktop:border-0 desktop:border-t desktop:border-line desktop:px-3.5"
        onsubmit={food.submit('usual_from_meal', `from_meal:${b.meal}`)}
        data-name-usual={b.meal}
      >
        <input type="hidden" name="day" value={day.day} />
        <input type="hidden" name="meal" value={b.meal} />
        <label for="usual-name-{b.meal}" class="text-xs text-muted">Name for the usual meal ({b.lines.map((l) => l.name).join(', ')})</label>
        <input
          id="usual-name-{b.meal}"
          name="name"
          maxlength="60"
          autocomplete="off"
          required
          placeholder="e.g. Lunch at work"
          bind:value={food.usualName}
          oninput={() => (food.usualErr = null)}
          class="h-11 w-full rounded-lg border border-line bg-panel px-3 text-[15px] text-text desktop:h-9 desktop:max-w-96"
        />
        {#if food.usualErr}<p role="alert" class="m-0 rounded-lg bg-amber-bg px-2.5 py-2 text-amber" data-usual-err>{food.usualErr}</p>{/if}
        <div class="flex gap-2">
          <button type="submit" class="min-h-11 cursor-pointer rounded-lg border-0 bg-text px-4 font-medium text-bg disabled:opacity-60 desktop:min-h-9" disabled={!!food.busy[`from_meal:${b.meal}`]}
            >Save</button
          >
          <button type="button" class="min-h-11 cursor-pointer rounded-lg border border-line bg-panel px-4 text-text desktop:min-h-9" onclick={() => food.nameMeal(b.meal)}
            >Cancel</button
          >
        </div>
      </form>
    {/if}
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
          <FoodEditor row={l.row} host={food} />
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
