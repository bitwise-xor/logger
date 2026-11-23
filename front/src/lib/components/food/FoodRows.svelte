<script lang="ts">
  import EveryValue from '#lib/components/food/EveryValue.svelte';
  import FoodEditor from '#lib/components/food/FoodEditor.svelte';
  import { foodBlocks, type FoodDay } from '#lib/food.js';
  import { n } from '#lib/format.js';
  import { getFoodPage } from '#lib/foodday.svelte.js';
  import { anyUnknown, COLUMNS, dayRows, GRID, mealCells, mealMacros, totalLabel, valueCell, type Cell, type Column } from '#lib/foodvalues.js';

  let { day }: { day: FoodDay } = $props();
  const food = getFoodPage();
  const blocks = $derived(foodBlocks(day));
  const closing = $derived(dayRows(day));
  // the line under the closing rows explains "?" and "≥": in both modes when the four macros have unknowns, else in All values only
  const unknownMacros = $derived(anyUnknown(day, 'macros'));
  const unknownAll = $derived(anyUnknown(day, 'all'));

  // One grid for both widths: the phone shows time, food and kcal (the mockup's cards); the PC one table. Web 73: in All values
  // (the default) ten value columns and the amount under the food's name; in Macros the table as it was (Amount, kcal, Protein, Fat,
  // Carbs). The two modes are CSS variants (`allvalues:`, `macros:`: static/theme.js sets the choice before first paint).
  const cols =
    'grid-cols-[44px_minmax(0,1fr)_auto] desktop:allvalues:grid-cols-[48px_minmax(0,1fr)_repeat(10,60px)_40px] desktop:allvalues:gap-2 desktop:macros:grid-cols-[64px_minmax(0,1fr)_128px_72px_72px_64px_64px_48px] desktop:macros:gap-3';
  const pc = 'hidden text-right desktop:block';
  /** A value column on the PC: the four macros in both modes, the other six in All values only. */
  const colClass = (c: Column) => (c.macro ? 'hidden text-right desktop:block' : 'hidden text-right desktop:allvalues:block');
  /** The amount column: Macros only (in All values the amount stands under the food's name). */
  const amountCol = 'hidden text-right desktop:macros:block';
  const toneClass = (c: Cell) => (c.tone === 'amber' ? 'text-amber' : c.tone === 'muted' ? 'text-muted' : '');
  // a meal's note control (21.11.2026): quiet, as the line's other button
  const noteBtn =
    'inline-flex min-h-11 cursor-pointer items-center gap-1 border-0 bg-transparent px-1 text-[13px] font-medium tracking-normal text-muted normal-case hover:text-text desktop:min-h-8';
  const btn = 'min-h-11 cursor-pointer rounded-lg px-4 font-medium disabled:opacity-60 desktop:min-h-9';
</script>

{#snippet pencil()}
  <svg aria-hidden="true" width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"
    ><path d="M10.5 2.5l3 3L5.5 13.5H2.5v-3z"></path></svg
  >
{/snippet}

<!-- A number of the PC table: " g" after protein, fat and carbs in Macros (the header has no unit there), never after "?" or "≥". -->
{#snippet num(c: Cell, cls: string)}
  <span class="num whitespace-nowrap {cls} {toneClass(c)}">{c.text}{#if c.grams}<span class="hidden macros:inline">{' g'}</span>{/if}</span>
{/snippet}

<!-- The phone's three-by-three grid of the nine values after kcal (a food row, a meal's total). -->
{#snippet grid(cells: Record<string, Cell>)}
  <span class="grid w-full max-w-[440px] grid-cols-3 gap-x-3.5 gap-y-0.5 text-xs" data-value-grid>
    {#each GRID as g (g.key)}
      <span class="flex min-w-0 justify-between gap-1.5"
        ><span class="truncate text-muted">{g.grid}</span><span class="num whitespace-nowrap {toneClass(cells[g.key]!)}">{cells[g.key]!.text}</span></span
      >
    {/each}
  </span>
{/snippet}

<!-- A meal's note field (21.11.2026): one line, Save, Remove (when there is a note), Cancel; meal 0 is the day's note. -->
{#snippet noteForm(meal: number, current: string | null)}
  <form
    method="POST"
    action="?/food_mealnote"
    class="m-0 flex flex-col gap-2 rounded-lg border border-blue bg-panel2 px-3 py-2.5 desktop:rounded-none desktop:border-0 desktop:border-t desktop:border-line desktop:px-3.5"
    onsubmit={food.submit('food_mealnote', `mealnote:${meal}`)}
    data-note-form={meal}
  >
    <input type="hidden" name="day" value={day.day} />
    <input type="hidden" name="meal" value={meal} />
    <label for="meal-note-{meal}" class="text-xs text-muted">{meal ? 'Note on this meal' : 'Note on this day'}</label>
    <input
      id="meal-note-{meal}"
      name="note"
      maxlength="300"
      autocomplete="off"
      placeholder="e.g. Ate out, portions guessed"
      bind:value={food.noteText}
      oninput={() => (food.noteErr = null)}
      class="h-11 w-full rounded-lg border border-line bg-panel px-3 text-[15px] text-text desktop:h-9 desktop:max-w-[560px]"
    />
    {#if food.noteErr}<p role="alert" class="m-0 rounded-lg bg-amber-bg px-2.5 py-2 text-amber" data-note-err>{food.noteErr}</p>{/if}
    <div class="flex flex-wrap gap-2">
      <button type="submit" class="{btn} border-0 bg-text text-bg" disabled={!!food.busy[`mealnote:${meal}`] || !food.noteText.trim()}>Save</button>
      {#if current}
        <button
          type="button"
          class="{btn} border border-line bg-panel text-text"
          disabled={!!food.busy[`mealnote:${meal}`]}
          onclick={() => food.tap('food_mealnote', `mealnote:${meal}`, { day: day.day, meal: String(meal), note: '' })}
          data-note-remove>Remove</button
        >
      {/if}
      <button type="button" class="{btn} border border-line bg-panel font-normal text-text" onclick={() => food.noteMeal(meal, current)}>Cancel</button>
    </div>
  </form>
{/snippet}

<!-- On the PC the table scrolls sideways in its box when the ten columns do not fit (windows of about 1100 to 1200 px); the page never does. -->
<section
  aria-labelledby="food-rows-h"
  class="desktop:overflow-x-auto desktop:rounded-card desktop:border desktop:border-line desktop:bg-panel"
  data-card="food-rows"
>
 <div class="flex flex-col gap-1.5 desktop:gap-0 desktop:allvalues:min-w-[950px]" data-rows-inner>
  <h2 id="food-rows-h" class="m-0 text-xs font-normal text-muted desktop:sr-only">Tap a food to see every value, or to change its amount, time or note, or to delete it. "Save as usual meal" keeps a meal's foods and amounts under a name.</h2>
  {#if blocks.length === 0}
    <p class="m-0 text-muted desktop:px-3.5 desktop:py-3">Nothing logged {day.past ? 'on this day' : 'yet today'}.</p>
  {:else}
    <div class="hidden {cols} items-center gap-3 px-3.5 py-2.5 text-xs font-medium text-muted desktop:grid" aria-hidden="true" data-rows-head>
      <span>Time</span><span>Food</span><span class={amountCol}>Amount</span>
      {#each COLUMNS as c (c.key)}
        <span class="{colClass(c)} whitespace-nowrap"
          >{#if c.macroHead}<span class="macros:hidden">{c.head}</span><span class="hidden macros:inline">{c.macroHead}</span>{:else}{c.head}{/if}</span
        >
      {/each}
      <span></span>
    </div>
  {/if}
  {#if day.day_note !== null || food.noting === 0}
    <!-- A meal note whose meals are all gone: a note on the day (21.11.2026). -->
    <div class="flex flex-col gap-1 px-0.5 desktop:px-3.5 desktop:py-2" data-day-note>
      <div class="flex min-h-11 items-center gap-2 desktop:min-h-8">
        <span class="text-xs font-medium tracking-[0.06em] text-muted uppercase">Note on this day</span>
        <span class="flex-1"></span>
        <button type="button" class={noteBtn} aria-expanded={food.noting === 0} onclick={() => food.noteMeal(0, day.day_note)} data-note-open="0"
          >{@render pencil()}Change</button
        >
      </div>
      {#if food.noting !== 0}<p class="m-0 text-[13px] break-words text-muted" data-meal-note="0">{day.day_note}</p>{/if}
    </div>
    {#if food.noting === 0}{@render noteForm(0, day.day_note)}{/if}
  {/if}
  {#each blocks as b (b.key)}
    {@const naming = food.naming === b.meal}
    {@const noting = food.noting === b.meal}
    <div
      id="meal-{b.meal}"
      class="flex min-h-11 scroll-mt-4 flex-wrap items-center gap-x-2 px-0.5 pt-1 text-xs font-medium tracking-[0.06em] text-muted uppercase desktop:min-h-0 desktop:border-t desktop:border-line desktop:bg-panel2 desktop:px-3.5 desktop:py-1"
      data-meal-label
    >
      <span>{b.label}</span>
      <span class="flex-1"></span>
      {#if b.meal !== 0 && !b.note}
        <button type="button" class={noteBtn} aria-expanded={noting} onclick={() => food.noteMeal(b.meal, b.note)} data-note-open={b.meal}
          >{@render pencil()}Add note</button
        >
      {/if}
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
    {#if b.note && !noting}
      <!-- The meal's note, in the muted style of a food's note; a tap opens it to change or remove. -->
      <button
        type="button"
        class="-mt-0.5 flex min-h-11 w-full cursor-pointer items-start gap-1.5 border-0 bg-transparent px-0.5 py-1 text-left text-[13px] text-muted desktop:min-h-0 desktop:px-3.5 desktop:py-1.5"
        aria-expanded="false"
        onclick={() => food.noteMeal(b.meal, b.note)}
        data-meal-note={b.meal}
        ><span class="mt-0.5 shrink-0">{@render pencil()}</span><span class="min-w-0 break-words">{b.note}</span></button
      >
    {/if}
    {#if noting}{@render noteForm(b.meal, b.note)}{/if}
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
          class="grid min-h-[52px] w-full cursor-pointer {cols} items-center gap-2.5 border-0 bg-transparent px-3 py-1.5 text-left text-text desktop:min-h-11 desktop:px-3.5 {open
            ? 'desktop:bg-blue-bg'
            : ''}"
          aria-expanded={open}
          onclick={() => food.toggle(l.ref)}
        >
          <span class="num text-xs text-muted desktop:text-[13px]">{l.time}</span>
          <span class="flex min-w-0 flex-col">
            <span class="break-words desktop:truncate {open ? 'desktop:font-medium' : ''}">{l.name}</span>
            <span class="num text-xs text-muted desktop:hidden" data-sub
              >{l.amount}<span class="hidden macros:inline">{` · ${n(l.row.nutrients.protein)} g protein`}</span></span
            >
            <span class="num hidden text-xs text-muted desktop:allvalues:block" data-amount-under>{l.amount}</span>
            {#if l.note}<span class="text-xs text-muted" data-note>Note: {l.note}</span>{/if}
          </span>
          <span class="num {amountCol}">{l.amount}</span>
          <span class="num text-[13px] whitespace-nowrap desktop:text-right desktop:text-sm {l.row.values?.kcal === null ? 'desktop:text-amber' : ''}" data-kcal
            >{n(l.row.nutrients.kcal)}<span class="desktop:hidden">{' kcal'}</span></span
          >
          {#each COLUMNS.slice(1) as c (c.key)}
            {@render num(valueCell(c.key, l.row.values ? l.row.values[c.key] : null), colClass(c))}
          {/each}
          <span class="{pc} text-[13px] text-muted">{open ? 'Close' : 'Edit'}</span>
          {#if !open && l.row.values}
            <!-- Web 73, the phone in All values: the nine other values under the row's first line (hidden while it is open) -->
            <span class="col-span-full pl-[54px] macros:hidden desktop:hidden">
              {@render grid(Object.fromEntries(GRID.map((g) => [g.key, valueCell(g.key, l.row.values[g.key], 'card')])))}
            </span>
          {/if}
        </button>
        {#if open}
          {#if l.row.values}<EveryValue row={l.row} />{/if}
          <FoodEditor row={l.row} host={food} />
        {/if}
      </div>
    {/each}
    {#if b.values && b.unknown}
      {@const table = mealCells(b.values, b.unknown, 'table')}
      {@const card = mealCells(b.values, b.unknown, 'card')}
      <!-- Web 73: the meal's total, in both modes (PC: a row across the value columns; phone: a card) -->
      <div class="hidden {cols} min-h-10 items-center gap-3 border-t border-line px-3.5 py-1.5 font-semibold desktop:grid" data-meal-total={b.meal}>
        <span></span><span>{totalLabel(b.label)}</span><span class={amountCol}></span>
        {#each COLUMNS as c (c.key)}{@render num(table[c.key], colClass(c))}{/each}
        <span></span>
      </div>
      <div class="flex flex-col gap-1.5 rounded-lg border border-line bg-panel2 px-3 py-2 desktop:hidden" data-meal-card={b.meal}>
        <span class="flex items-baseline gap-2.5">
          <span class="min-w-0 flex-1 font-semibold">{totalLabel(b.label)}</span>
          <span class="num text-[13px] font-medium whitespace-nowrap {toneClass(card.kcal)}" data-meal-kcal>{card.kcal.text} kcal</span>
        </span>
        <span class="num hidden text-xs text-muted macros:block" data-meal-macros>{mealMacros(b.values, b.unknown)}</span>
        <span class="pl-[54px] macros:hidden">{@render grid(card)}</span>
      </div>
    {/if}
  {/each}
  {#if blocks.length}
    <!-- Web 73: the day closes with its total, the daily budget (the targets in force that day) and the difference, as an amount and
         in percent of the budget; "–" where no budget is set. The phone has the Day total card (FoodDayTotal.svelte) instead. -->
    {#each closing as r, i (r.label)}
      <div
        class="hidden {cols} min-h-10 items-center gap-3 bg-panel2 px-3.5 py-1.5 desktop:grid {i === 0 ? 'min-h-11 border-t-2 border-line' : 'border-t border-line'} {r.label ===
        'Daily budget'
          ? 'font-normal'
          : 'font-semibold'}"
        data-total={i === 0 ? '' : undefined}
        data-day-row={r.label}
      >
        <span></span><span>{r.label}</span><span class={amountCol}></span>
        {#each COLUMNS as c (c.key)}{@render num(r.cells[c.key]!, colClass(c))}{/each}
        <span></span>
      </div>
    {/each}
    <p class="m-0 hidden border-t border-line px-3.5 pt-2 pb-3 text-[13px] text-muted desktop:block" data-day-foot>
      Difference is the day total minus the daily budget, as an amount and in percent of the budget: − is under it, + is over it, and –
      means no budget is set.
      <span class={unknownMacros ? '' : unknownAll ? 'hidden allvalues:inline' : 'hidden'}
        ><span class="text-amber">?</span> means the food has no value for it. <span class="text-amber">≥</span> means the total leaves those foods out.</span
      >
    </p>
  {/if}
 </div>
</section>
